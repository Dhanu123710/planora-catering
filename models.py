from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), default='user') # admin, user, employee
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class EventType(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    base_price = db.Column(db.Float, nullable=False)
    package_items = db.Column(db.String(500), default='') # comma separated item IDs

class MenuItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False) # Starter, Main Course, Dessert, Drink
    price = db.Column(db.Float, nullable=False)
    image_url = db.Column(db.String(200), default='default_food.jpg')

class Package(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False) # Silver, Gold, Platinum
    description = db.Column(db.Text)
    price_per_guest = db.Column(db.Float, nullable=False)
    # Store a simple list of recommended item names or IDs for convenience
    items_summary = db.Column(db.String(200)) 

class Booking(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    event_type_id = db.Column(db.Integer, db.ForeignKey('event_type.id'), nullable=False)
    package_id = db.Column(db.Integer, db.ForeignKey('package.id'))
    guests = db.Column(db.Integer, nullable=False)
    total_price = db.Column(db.Float, nullable=False)
    service_type = db.Column(db.String(50), nullable=False) # Normal, Buffet, Live Cooking
    notes = db.Column(db.Text)
    contact_phone = db.Column(db.String(20))
    delivery_address = db.Column(db.Text)
    status = db.Column(db.String(20), default='Pending') # Pending, Confirmed, Completed, Cancelled
    event_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    cancelled_at = db.Column(db.DateTime, nullable=True)
    payment_method = db.Column(db.String(50)) # UPI, Card, Net Banking, Cash
    refund_status = db.Column(db.String(50), default='None') # None, Initiated, Completed
    location = db.Column(db.String(100)) # Event Venue/Area
    delivery_charge = db.Column(db.Float, default=0.0)

    # Relationships
    user = db.relationship('User', backref=db.backref('bookings', lazy=True))
    event_type = db.relationship('EventType')
    package = db.relationship('Package')
    items = db.relationship('BookingItem', backref='booking', cascade="all, delete-orphan")

class BookingItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey('booking.id'), nullable=False)
    menu_item_id = db.Column(db.Integer, db.ForeignKey('menu_item.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    
    menu_item = db.relationship('MenuItem')

class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    contact = db.Column(db.String(20))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id')) # Link to user account for login

class Assignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey('booking.id'), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=False)
    is_completed = db.Column(db.Boolean, default=False)
    payment_amount = db.Column(db.Float, default=0.0)
    is_paid = db.Column(db.Boolean, default=False)
    paid_at = db.Column(db.DateTime)
    
    booking = db.relationship('Booking', backref=db.backref('assignments', lazy=True))
    employee = db.relationship('Employee', backref=db.backref('assignments', lazy=True))
