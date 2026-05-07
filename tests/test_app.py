import unittest
import os
import sys
from datetime import datetime, timedelta

# Add the parent directory to sys.path to import app and models
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask import url_for
from app import app, db
from models import User, MenuItem, EventType, Package, Booking

class PlanoraTestCase(unittest.TestCase):
    def setUp(self):
        """Set up a blank temp database before each test."""
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app = app.test_client()
        
        with app.app_context():
            db.create_all()
            self.seed_data()

    def tearDown(self):
        """Destroy blank temp database after each test."""
        with app.app_context():
            db.session.remove()
            db.drop_all()

    def seed_data(self):
        """Seed basic data for testing."""
        # Add Admin
        admin = User(name="Admin User", email="admin@test.com", role="admin")
        admin.set_password("admin123")
        
        # Add Regular User
        user = User(name="Regular User", email="user@test.com", role="user")
        user.set_password("user123")
        
        # Add Menu Item
        item = MenuItem(name="Chicken Tikka", category="Starter", price=250.0)
        
        # Add Event Type
        event = EventType(name="Wedding", base_price=50000.0)
        
        db.session.add(admin)
        db.session.add(user)
        db.session.add(item)
        db.session.add(event)
        db.session.commit()

    # --- Authentication Tests ---

    def test_login_logout(self):
        """Test login and logout functionality."""
        # Correct login
        response = self.app.post('/login', data=dict(
            email="user@test.com",
            password="user123"
        ), follow_redirects=True)
        # We check for Logout link to ensure we are logged in
        self.assertIn(b'Logout', response.data)
        
        # Logout - Don't follow redirects to external index
        response = self.app.get('/logout')
        self.assertEqual(response.status_code, 302)
        # In testing, the redirect location is often just '/' or 'http://localhost/'
        self.assertTrue(response.location.endswith('/') or 'localhost' in response.location)

    def test_invalid_login(self):
        """Test login with incorrect credentials."""
        response = self.app.post('/login', data=dict(
            email="user@test.com",
            password="wrongpassword"
        ), follow_redirects=True)
        self.assertIn(b'Invalid email or password', response.data)

    def test_admin_login_access(self):
        """Test that only admins can use the admin login portal."""
        # Try logging in as admin on admin portal
        response = self.app.post('/admin/login', data=dict(
            email="admin@test.com",
            password="admin123"
        ), follow_redirects=True)
        self.assertIn(b'Admin Panel', response.data)
        
        # Logout
        self.app.get('/logout')
        
        # Try logging in as regular user on admin portal
        response = self.app.post('/admin/login', data=dict(
            email="user@test.com",
            password="user123"
        ), follow_redirects=True)
        self.assertIn(b'Invalid admin credentials', response.data)

    def test_admin_dashboard_protection(self):
        """Ensure non-admins cannot access the admin dashboard."""
        # Access as guest - should redirect to login (internal) then maybe to index
        response = self.app.get('/admin')
        self.assertEqual(response.status_code, 302)
        
        # Login as regular user
        self.app.post('/login', data=dict(email="user@test.com", password="user123"))
        # Access as user - app.py logic says: if role != 'admin' redirect(url_for('index'))
        response = self.app.get('/admin')
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.location.endswith('/') or 'localhost' in response.location)

    # --- Business Logic Tests ---

    def test_quotation_calculation(self):
        """Test the quotation API calculation logic."""
        with app.app_context():
            item = MenuItem.query.filter_by(name="Chicken Tikka").first()
            event = EventType.query.filter_by(name="Wedding").first()
            
            payload = {
                "guests": 100,
                "event_type_id": event.id,
                "service_type": "Normal",
                "items": [item.id]
            }
            
            response = self.app.post('/api/calculate-quotation', 
                                    json=payload)
            data = response.get_json()
            
            # Formula: Total=((Base Price+Food Cost)×Guests)×(1+Service Multiplier)+GST
            # Base (50000) + Food (250) = 50250
            # 50250 * 100 = 5,025,000
            # GST (18%) = 904,500
            # Total = 5,929,500
            
            self.assertEqual(data['total'], 5929500.0)
            self.assertEqual(data['gst'], 904500.0)

    def test_availability_check(self):
        """Test the date availability API."""
        # Test past date
        past_date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        response = self.app.get(f'/api/check-availability?date={past_date}')
        self.assertFalse(response.get_json()['available'])
        self.assertIn('past dates', response.get_json()['message'])
        
        # Test too soon (under 15 days)
        soon_date = (datetime.now() + timedelta(days=5)).strftime('%Y-%m-%d')
        response = self.app.get(f'/api/check-availability?date={soon_date}')
        self.assertFalse(response.get_json()['available'])
        self.assertIn('15 days in advance', response.get_json()['message'])
        
        # Test valid future date
        future_date = (datetime.now() + timedelta(days=20)).strftime('%Y-%m-%d')
        response = self.app.get(f'/api/check-availability?date={future_date}')
        self.assertTrue(response.get_json()['available'])

if __name__ == '__main__':
    unittest.main()
