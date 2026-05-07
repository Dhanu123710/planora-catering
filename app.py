import os
import sys
print("Starting Flask App...", file=sys.stderr)
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_cors import CORS
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from models import db, User, EventType, MenuItem, Package, Booking, BookingItem, Employee, Assignment
from datetime import datetime
from collections import defaultdict

app = Flask(__name__)
app.config['SECRET_KEY'] = 'planora-secret-key-123'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///planora.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app) # Enable CORS for all routes

db.init_app(app)

login_manager = LoginManager()
login_manager.login_view = 'login'
login_manager.init_app(app)

# Create tables if they don't exist
try:
    with app.app_context():
        db.create_all()
        from models import EventType, Package, User
        # Auto-seed if database is empty
        if not EventType.query.first():
            print("Seeding database...", file=sys.stderr)
            wedding = EventType(name="Wedding", base_price=500.0)
            birthday = EventType(name="Birthday", base_price=300.0)
            corporate = EventType(name="Corporate", base_price=450.0)
            anniversary = EventType(name="Anniversary", base_price=400.0)
            db.session.add_all([wedding, birthday, corporate, anniversary])
            
            silver = Package(name="Silver", price_per_guest=800.0, items_summary="2 Starters, 2 Main, 1 Dessert")
            gold = Package(name="Gold", price_per_guest=1200.0, items_summary="3 Starters, 3 Main, 2 Desserts")
            platinum = Package(name="Platinum", price_per_guest=1800.0, items_summary="Unlimited Starters, Exotic Main, Live Stalls")
            db.session.add_all([silver, gold, platinum])
            
            if not User.query.filter_by(role='admin').first():
                admin = User(name="Admin", email="admin@planora.com", role="admin")
                admin.set_password("admin123")
                db.session.add(admin)
                
            # Create default employee if not exists
            if not User.query.filter_by(email='john@planora.com').first():
                emp = User(name="John Doe", email="john@planora.com", role="employee")
                emp.set_password("emp123")
                db.session.add(emp)
                
                # Also create the Employee profile record
                employee_profile = Employee(name="John Doe", role="Chef", email="john@planora.com")
                db.session.add(employee_profile)
            
            db.session.commit()
            print("Database seeded successfully!", file=sys.stderr)
    print("Database ready!", file=sys.stderr)
except Exception as e:
    print(f"Database initialization failed: {e}", file=sys.stderr)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- Routes ---

@app.route('/')
def index():
    return redirect("https://tranquil-pudding-09a4f3.netlify.app/")

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user)
            if user.role == 'admin':
                return redirect(url_for('admin_dashboard'))
            elif user.role == 'employee':
                return redirect(url_for('employee_dashboard'))
            return redirect(url_for('user_dashboard'))
        flash('Invalid email or password', 'danger')
    return render_template('login.html')

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if current_user.is_authenticated and current_user.role == 'admin':
        return redirect(url_for('admin_dashboard'))
        
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email, role='admin').first()
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('admin_dashboard'))
        flash('Invalid admin credentials', 'danger')
    return render_template('admin/login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'warning')
            return redirect(url_for('register'))
            
        new_user = User(name=name, email=email)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        flash('Registration successful!', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

# --- User Module ---

@app.route('/dashboard')
@login_required
def user_dashboard():
    bookings = Booking.query.filter_by(user_id=current_user.id).order_by(Booking.created_at.desc()).all()
    # Calculate if booking can be cancelled (within 24 hours of creation)
    for b in bookings:
        time_diff = datetime.utcnow() - b.created_at
        b.can_cancel = time_diff.total_seconds() <= 86400 and b.status != 'Cancelled'
    return render_template('user/dashboard.html', bookings=bookings)

@app.route('/book', methods=['GET', 'POST'])
@login_required
def book_event():
    # Only regular users can order
    if current_user.role != 'user':
        flash('Admins and Employees cannot place orders.', 'warning')
        return redirect(url_for('index'))
        
    if request.method == 'POST':
        # Logic handles AJAX booking in realistic scenario, but here simplified
        pass
    
    event_types = EventType.query.all()
    packages = Package.query.all()
    menu_items = MenuItem.query.all()
    return render_template('user/booking.html', event_types=event_types, packages=packages, menu_items=menu_items)

@app.route('/api/check-availability')
def check_availability():
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({'available': False, 'error': 'No date provided'})
    
    event_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    today = datetime.now().date()
    
    # 1. Check if date is in the past
    if event_date < today:
        return jsonify({'available': False, 'message': 'Cannot book events for past dates'})
        
    # 2. Check if date is at least 15 days in advance
    delta = (event_date - today).days
    if delta < 15:
        return jsonify({'available': False, 'message': 'Booking must be made at least 15 days in advance'})
    
    # Check if a booking already exists for this date
    existing_booking = Booking.query.filter_by(event_date=event_date).first()
    
    if existing_booking:
        return jsonify({'available': False, 'message': 'Slot not available for this date'})
    return jsonify({'available': True})

@app.route('/api/calculate-quotation', methods=['POST'])
def calculate_quotation():
    data = request.json
    guests = int(data.get('guests', 0))
    event_type_id = data.get('event_type_id')
    service_type = data.get('service_type', 'Normal')
    item_ids = data.get('items', [])
    
    event = EventType.query.get(event_type_id)
    if not event:
        return jsonify({'error': 'Event type not found'}), 400
    
    base_price = event.base_price
    food_cost = 0
    for item_id in item_ids:
        item = MenuItem.query.get(item_id)
        if item:
            food_cost += item.price
            
    # Formula: Total=((Base Price+Food Cost)×Guests)×(1+Service Multiplier)+GST
    service_multipliers = {
        'Normal': 0.0,
        'Buffet Setup': 0.15,
        'Live Cooking': 0.25
    }
    multiplier = 1 + service_multipliers.get(service_type, 0)
    
    subtotal = ((base_price + food_cost) * guests) * multiplier
    gst = subtotal * 0.18
    total = subtotal + gst
    
    return jsonify({
        'base_price': base_price,
        'food_cost': food_cost,
        'subtotal': subtotal,
        'gst': gst,
        'total': total
    })

@app.route('/api/create-booking', methods=['POST'])
@login_required
def create_booking():
    if current_user.role != 'user':
        return jsonify({'success': False, 'message': 'Permission denied'}), 403
        
    data = request.json
    # Validation
    if int(data['guests']) < 10:
        return jsonify({'success': False, 'message': 'Minimum 10 guests required for ordering.'}), 400
        
    event_date = datetime.strptime(data['event_date'], '%Y-%m-%d').date()
    today = datetime.now().date()
    
    # Backend date validation
    if event_date < today:
        return jsonify({'success': False, 'message': 'Cannot book events for past dates.'}), 400
        
    if (event_date - today).days < 15:
        return jsonify({'success': False, 'message': 'Booking must be made at least 15 days in advance.'}), 400
    
    new_booking = Booking(
        user_id=current_user.id,
        event_type_id=data['event_type_id'],
        package_id=data.get('package_id'),
        guests=data['guests'],
        total_price=data['total_price'],
        service_type=data['service_type'],
        notes=data.get('notes', ''),
        contact_phone=data.get('contact_phone', ''),
        delivery_address=data.get('delivery_address', ''),
        event_date=event_date,
        status='Pending',
        payment_method=data.get('payment_method', 'Cash'),
        refund_status='None',
        location=data.get('location', ''),
        delivery_charge=float(data.get('delivery_charge', 0))
    )
    db.session.add(new_booking)
    db.session.flush() # Get ID
    
    for item_id in data['items']:
        bi = BookingItem(booking_id=new_booking.id, menu_item_id=item_id, quantity=data['guests'])
        db.session.add(bi)
        
    db.session.commit()
    return jsonify({'success': True, 'booking_id': new_booking.id})

@app.route('/invoice/<int:booking_id>')
@login_required
def view_invoice(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if booking.user_id != current_user.id and current_user.role != 'admin':
        return "Unauthorized", 403
        
    # Calculate breakdown again for display
    service_multipliers = {'Normal': 0.0, 'Buffet Setup': 0.15, 'Live Cooking': 0.25}
    base_price = booking.event_type.base_price
    food_cost = sum([item.menu_item.price for item in booking.items])
    multiplier = 1 + service_multipliers.get(booking.service_type, 0)
    subtotal = ((base_price + food_cost) * booking.guests) * multiplier
    gst = subtotal * 0.18
    
    return render_template('invoice.html', booking=booking, base_price=base_price, food_cost=food_cost, subtotal=subtotal, gst=gst)

@app.route('/api/cancel-booking/<int:booking_id>', methods=['POST'])
@login_required
def cancel_booking(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    
    # Ensure user owns the booking or is an admin
    if booking.user_id != current_user.id and current_user.role != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
    if booking.status == 'Cancelled':
        return jsonify({'success': False, 'message': 'Booking is already cancelled.'}), 400
        
    # Check if within 24 hours
    time_diff = datetime.utcnow() - booking.created_at
    if time_diff.total_seconds() > 86400:
        return jsonify({'success': False, 'message': 'Cancellations are only allowed within 24 hours of placing the booking.'}), 400
        
    booking.status = 'Cancelled'
    booking.cancelled_at = datetime.utcnow()
    booking.refund_status = 'Initiated'
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/calendar-events')
@login_required
def get_calendar_events():
    if current_user.role == 'admin':
        bookings = Booking.query.all()
    else:
        bookings = Booking.query.filter_by(user_id=current_user.id).all()
        
    events = []
    status_colors = {
        'Pending': '#cfa616',
        'Confirmed': '#3b82f6',
        'Completed': '#10b981',
        'Cancelled': '#ff4d4d'
    }
    
    for b in bookings:
        events.append({
            'id': b.id,
            'title': f"{b.event_type.name} - {b.user.name}",
            'start': b.event_date.isoformat(),
            'backgroundColor': status_colors.get(b.status, '#3b82f6'),
            'borderColor': status_colors.get(b.status, '#3b82f6'),
            'url': url_for('view_invoice', booking_id=b.id)
        })
    return jsonify(events)

# --- Admin Module ---

@app.route('/admin')
@login_required
def admin_dashboard():
    if current_user.role != 'admin':
        flash('Unauthorized access. Please login as Administrator.', 'danger')
        return redirect(url_for('login'))
    bookings = Booking.query.order_by(Booking.created_at.desc()).all()
    employees = Employee.query.all()
    
    # Financial metrics
    paid_bookings = [b for b in bookings if b.status in ['Completed', 'Confirmed']]
    gross_revenue = sum([b.total_price for b in paid_bookings])
    
    paid_assignments = Assignment.query.filter_by(is_paid=True).order_by(Assignment.paid_at.desc()).all()
    total_expenses = sum([a.payment_amount for a in paid_assignments])
    
    net_revenue = gross_revenue - total_expenses
    
    # Chart Data Preparation
    daily_rev_dict = defaultdict(float)
    daily_orders_dict = defaultdict(int)
    for b in paid_bookings:
        date_str = b.event_date.strftime('%Y-%m-%d')
        daily_rev_dict[date_str] += b.total_price
        daily_orders_dict[date_str] += 1
        
    chart_dates = sorted(list(set(list(daily_rev_dict.keys()) + list(daily_orders_dict.keys()))))
    chart_rev_data = [daily_rev_dict[d] for d in chart_dates]
    chart_orders_data = [daily_orders_dict[d] for d in chart_dates]
    
    emp_payouts_dict = defaultdict(float)
    for a in paid_assignments:
        emp_payouts_dict[a.employee.name] += a.payment_amount
        
    chart_emp_names = list(emp_payouts_dict.keys())
    chart_emp_payouts = list(emp_payouts_dict.values())
    
    return render_template('admin/dashboard.html', 
                           bookings=bookings, 
                           employees=employees,
                           gross_revenue=gross_revenue,
                           total_expenses=total_expenses,
                           net_revenue=net_revenue,
                           paid_bookings=paid_bookings,
                           paid_assignments=paid_assignments,
                           chart_dates=chart_dates,
                           chart_rev_data=chart_rev_data,
                           chart_orders_data=chart_orders_data,
                           chart_emp_names=chart_emp_names,
                           chart_emp_payouts=chart_emp_payouts)

@app.route('/admin/update-status/<int:booking_id>', methods=['POST'])
@login_required
def update_status(booking_id):
    if current_user.role != 'admin': return jsonify({'success': False}), 403
    status = request.json.get('status')
    booking = Booking.query.get(booking_id)
    if booking:
        booking.status = status
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False}), 404

@app.route('/admin/assign-employee', methods=['POST'])
@login_required
def assign_employee():
    if current_user.role != 'admin': return jsonify({'success': False}), 403
    booking_id = request.json.get('booking_id')
    employee_id = request.json.get('employee_id')
    
    # Remove existing assignments for this booking if any
    Assignment.query.filter_by(booking_id=booking_id).delete()
    
    new_assignment = Assignment(booking_id=booking_id, employee_id=employee_id)
    db.session.add(new_assignment)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/admin/employees', methods=['GET', 'POST'])
@login_required
def admin_employees():
    if current_user.role != 'admin': return redirect(url_for('index'))
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        contact = request.form.get('contact')
        password = request.form.get('password', 'emp123') # Default password if not provided
        
        if User.query.filter_by(email=email).first():
            flash('Email already in use', 'danger')
        else:
            new_user = User(name=name, email=email, role='employee')
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.flush()
            
            new_emp = Employee(name=name, contact=contact, user_id=new_user.id)
            db.session.add(new_emp)
            db.session.commit()
            flash('Employee added successfully', 'success')
        return redirect(url_for('admin_dashboard'))
    
    employees = Employee.query.all()
    return render_template('admin/dashboard.html', employees=employees)

@app.route('/admin/employees/delete/<int:emp_id>', methods=['POST'])
@login_required
def delete_employee(emp_id):
    if current_user.role != 'admin': return jsonify({'success': False}), 403
    emp = Employee.query.get_or_404(emp_id)
    user = User.query.get(emp.user_id)
    
    # Delete related assignments first to avoid FK constraints
    Assignment.query.filter_by(employee_id=emp_id).delete()
    
    db.session.delete(emp)
    if user:
        db.session.delete(user)
    db.session.commit()
    flash('Employee deleted', 'info')
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/pay-assignment', methods=['POST'])
@login_required
def pay_assignment():
    if current_user.role != 'admin': return jsonify({'success': False}), 403
    assignment_id = request.json.get('assignment_id')
    amount = float(request.json.get('amount', 0))
    
    assignment = Assignment.query.get(assignment_id)
    if assignment:
        assignment.payment_amount = amount
        assignment.is_paid = True
        assignment.paid_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False}), 404

@app.route('/payment-receipt/<int:asgn_id>')
@login_required
def view_payment_receipt(asgn_id):
    assignment = Assignment.query.get_or_404(asgn_id)
    # Check if authorized (admin or the employee assigned)
    is_employee = False
    employee = Employee.query.filter_by(user_id=current_user.id).first()
    if employee and assignment.employee_id == employee.id:
        is_employee = True
        
    if current_user.role != 'admin' and not is_employee:
        return "Unauthorized", 403
        
    if not assignment.is_paid:
        return "Receipt not available yet", 400
        
    return render_template('employee_receipt.html', assignment=assignment)

# --- Admin Content Management ---

@app.route('/admin/menu')
@login_required
def manage_menu():
    if current_user.role != 'admin': return redirect(url_for('index'))
    items = MenuItem.query.all()
    return render_template('admin/menu.html', items=items)

@app.route('/admin/menu/add', methods=['POST'])
@login_required
def add_menu_item():
    if current_user.role != 'admin': return jsonify({'success': False}), 403
    name = request.form.get('name')
    category = request.form.get('category')
    price = float(request.form.get('price', 0))
    image_url = request.form.get('image_url', 'default_food.jpg')
    
    new_item = MenuItem(name=name, category=category, price=price, image_url=image_url)
    db.session.add(new_item)
    db.session.commit()
    flash('Menu item added successfully!', 'success')
    return redirect(url_for('manage_menu'))

@app.route('/admin/menu/edit/<int:item_id>', methods=['POST'])
@login_required
def edit_menu_item(item_id):
    if current_user.role != 'admin': return jsonify({'success': False}), 403
    item = MenuItem.query.get_or_404(item_id)
    item.name = request.form.get('name')
    item.category = request.form.get('category')
    item.price = float(request.form.get('price', 0))
    item.image_url = request.form.get('image_url', item.image_url)
    db.session.commit()
    flash('Menu item updated!', 'success')
    return redirect(url_for('manage_menu'))

@app.route('/admin/menu/delete/<int:item_id>')
@login_required
def delete_menu_item(item_id):
    if current_user.role != 'admin': return jsonify({'success': False}), 403
    item = MenuItem.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    flash('Menu item deleted!', 'success')
    return redirect(url_for('manage_menu'))

@app.route('/admin/events')
@login_required
def manage_events():
    if current_user.role != 'admin': return redirect(url_for('index'))
    events = EventType.query.all()
    return render_template('admin/events.html', events=events)

@app.route('/admin/event/add', methods=['POST'])
@login_required
def add_event_type():
    if current_user.role != 'admin': return jsonify({'success': False}), 403
    name = request.form.get('name')
    base_price = float(request.form.get('base_price', 0))
    
    new_event = EventType(name=name, base_price=base_price)
    db.session.add(new_event)
    db.session.commit()
    flash('Event type added!', 'success')
    return redirect(url_for('manage_events'))

@app.route('/admin/event/edit/<int:event_id>', methods=['POST'])
@login_required
def edit_event_type(event_id):
    if current_user.role != 'admin': return jsonify({'success': False}), 403
    event = EventType.query.get_or_404(event_id)
    event.name = request.form.get('name')
    event.base_price = float(request.form.get('base_price', 0))
    db.session.commit()
    flash('Event type updated!', 'success')
    return redirect(url_for('manage_events'))

@app.route('/admin/event/delete/<int:event_id>')
@login_required
def delete_event_type(event_id):
    if current_user.role != 'admin': return jsonify({'success': False}), 403
    event = EventType.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    flash('Event type deleted!', 'success')
    return redirect(url_for('manage_events'))

# --- Employee Module ---

@app.route('/employee')
@login_required
def employee_dashboard():
    if current_user.role != 'employee': return redirect(url_for('index'))
    employee = Employee.query.filter_by(user_id=current_user.id).first()
    if not employee:
        return "Employee profile not found", 404
    assignments = Assignment.query.filter_by(employee_id=employee.id).all()
    return render_template('employee/dashboard.html', assignments=assignments)

@app.route('/employee/complete-assignment/<int:asgn_id>', methods=['POST'])
@login_required
def complete_assignment(asgn_id):
    if current_user.role != 'employee': return jsonify({'success': False}), 403
    assignment = Assignment.query.get_or_404(asgn_id)
    
    # Ensure this assignment belongs to the current user
    employee = Employee.query.filter_by(user_id=current_user.id).first()
    if not employee or assignment.employee_id != employee.id:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
    assignment.is_completed = True
    # Also update booking status to completed for simplicity
    assignment.booking.status = 'Completed'
    
    db.session.commit()
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True)
