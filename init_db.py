from app import app, db
from models import User, EventType, MenuItem, Package, Employee
from werkzeug.security import generate_password_hash

def seed_db():
    with app.app_context():
        # Create tables
        db.drop_all()
        db.create_all()

        # Create Admin
        admin = User(name="Admin User", email="admin@planora.com", role="admin")
        admin.set_password("admin123")
        db.session.add(admin)

        # Create Employee User
        emp_user = User(name="John Staff", email="john@planora.com", role="employee")
        emp_user.set_password("john123")
        db.session.add(emp_user)
        db.session.flush()

        employee = Employee(name="John Staff", contact="9876543210", user_id=emp_user.id)
        db.session.add(employee)

        # Create Test User
        user = User(name="Regular Customer", email="user@gmail.com", role="user")
        user.set_password("user123")
        db.session.add(user)

        # Event Types
        wedding = EventType(name="Wedding", base_price=500.0)
        birthday = EventType(name="Birthday", base_price=300.0)
        corporate = EventType(name="Corporate", base_price=450.0)
        anniversary = EventType(name="Anniversary", base_price=400.0)
        db.session.add_all([wedding, birthday, corporate, anniversary])

        # Menu Items
        items = [
            MenuItem(name="Paneer Tikka", category="Starter", price=150.0),
            MenuItem(name="Chicken 65", category="Starter", price=180.0),
            MenuItem(name="Spring Rolls", category="Starter", price=120.0),
            MenuItem(name="Butter Chicken", category="Main Course", price=250.0),
            MenuItem(name="Veg Biryani", category="Main Course", price=200.0),
            MenuItem(name="Dal Makhani", category="Main Course", price=160.0),
            MenuItem(name="Gulab Jamun", category="Dessert", price=80.0),
            MenuItem(name="Fruit Salad", category="Dessert", price=100.0),
            MenuItem(name="Chocolate Lava Cake", category="Dessert", price=150.0),
            MenuItem(name="Fresh Lime Soda", category="Drink", price=50.0),
            MenuItem(name="Iced Tea", category="Drink", price=70.0),
            MenuItem(name="Mocktail", category="Drink", price=120.0),
        ]
        db.session.add_all(items)

        # Packages
        silver = Package(name="Silver", description="Basic setup with essential starers and main course.", price_per_guest=800.0, items_summary="2 Starters, 2 Main, 1 Dessert")
        gold = Package(name="Gold", description="Premium setup with variety of choices.", price_per_guest=1200.0, items_summary="3 Starters, 3 Main, 2 Dessert, 1 Drink")
        platinum = Package(name="Platinum", description="Luxury experience with live stalls and exotic menu.", price_per_guest=1800.0, items_summary="All inclusive + Live Stalls")
        db.session.add_all([silver, gold, platinum])

        db.session.commit()
        print("Database seeded successfully!")

if __name__ == "__main__":
    seed_db()
