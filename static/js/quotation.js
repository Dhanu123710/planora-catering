let state = {
    step: 1,
    guests: 50,
    event_type_id: null,
    package_id: null,
    selected_items: [], // Array of {id, price}
    service_type: 'Normal',
    event_date: null,
    total: 0
};

// --- Step Navigation ---
function nextStep(step) {
    // Guest Validation for Step 1 -> 2
    if (state.step === 1 && step === 2) {
        if (state.guests < 10) {
            document.getElementById('guest_warning').style.display = 'block';
            return;
        }
        if (!state.event_date) {
            alert("Please select a date first.");
            return;
        }
    }
    
    document.querySelectorAll('.step-container').forEach(s => s.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');
    state.step = step;
}

// --- Instant Quote (Skip Customization) ---
function instantQuote() {
    if (!state.package_id) {
        alert("Please select a package first.");
        return;
    }
    // Skip Step 3 and go to Step 4
    nextStep(4);
}
// --- Availability Check ---
document.getElementById('event_date').addEventListener('change', function(e) {
    const date = e.target.value;
    state.event_date = date;
    const msgEl = document.getElementById('availability_msg');
    const btn = document.getElementById('btnStep1');
    
    // Frontend date validation
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = selectedDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        msgEl.innerText = "❌ Cannot book events for past dates.";
        msgEl.style.color = "#ff4444";
        btn.disabled = true;
        return;
    }
    
    if (diffDays < 15) {
        msgEl.innerText = "❌ Booking must be made at least 15 days in advance.";
        msgEl.style.color = "#ff4444";
        btn.disabled = true;
        return;
    }
    
    msgEl.innerText = "Checking availability...";
    msgEl.style.color = "var(--text-dim)";
    
    fetch(`/api/check-availability?date=${date}`)
        .then(res => res.json())
        .then(data => {
            if (data.available) {
                msgEl.innerText = "✅ Slot Available!";
                msgEl.style.color = "var(--accent)";
                btn.disabled = false;
            } else {
                msgEl.innerText = "❌ " + data.message;
                msgEl.style.color = "#ff4444";
                btn.disabled = true;
            }
        });
});

// --- Event & Guest Listeners ---
document.getElementById('event_type').addEventListener('change', updateQuotation);
document.getElementById('guests').addEventListener('input', function(e) {
    state.guests = parseInt(e.target.value) || 0;
    
    if (state.guests >= 10) {
        document.getElementById('guest_warning').style.display = 'none';
    } else if (state.step === 1) {
        document.getElementById('guest_warning').style.display = 'block';
    }
    
    document.getElementById('summary_guests').innerText = state.guests;
    updateQuotation();
    updateSuggestions();
});

// --- Package Selection ---
function selectPackage(id, name, pricePerGuest) {
    state.package_id = id;
    document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // The price per guest logic update (Plan: Package Price used if selected)
    // We update the base calculation to include package base if active
    updateQuotation();
}

// --- Menu Customization ---
function toggleItem(id, price, el) {
    const index = state.selected_items.findIndex(i => i.id === id);
    if (index > -1) {
        state.selected_items.splice(index, 1);
        el.classList.remove('selected');
    } else {
        state.selected_items.push({id, price});
        el.classList.add('selected');
    }
    updateQuotation();
    updateSuggestions();
}

// --- Service Type ---
function selectService(type, el) {
    state.service_type = type;
    document.querySelectorAll('.service-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    updateQuotation();
}

// --- Quotation Calculation ---
function updateQuotation() {
    const eventSelect = document.getElementById('event_type');
    const eventBase = parseFloat(eventSelect.options[eventSelect.selectedIndex].dataset.price) || 0;
    
    let foodCost = 0;
    state.selected_items.forEach(item => foodCost += item.price);
    
    state.event_type_id = eventSelect.value;
    
    const serviceMultipliers = {
        'Normal': 0.0,
        'Buffet Setup': 0.15,
        'Live Cooking': 0.25
    };
    const multiplier = 1 + serviceMultipliers[state.service_type];
    
    // Total=((Event Base+Food Cost)×Guests)×(1+Service Multiplier)+GST
    const subtotal = ((eventBase + foodCost) * state.guests) * multiplier;
    const gst = subtotal * 0.18;
    const total = subtotal + gst;
    
    state.total = total;

    // Update UI
    document.getElementById('price_base').innerText = `₹${eventBase}`;
    document.getElementById('price_food').innerText = `₹${foodCost}`;
    document.getElementById('price_service').innerText = state.service_type === 'Normal' ? 'Included' : `+${(serviceMultipliers[state.service_type]*100)}%`;
    document.getElementById('price_subtotal').innerText = `₹${subtotal.toLocaleString()}`;
    document.getElementById('price_gst').innerText = `₹${gst.toLocaleString()}`;
    document.getElementById('price_total').innerText = `₹${total.toLocaleString()}`;
}

// --- Premium Payment Processor Logic ---
function showPaymentModal() {
    if (state.guests < 10) {
        alert("Minimum 10 guests required.");
        return;
    }
    
    document.getElementById('paymentOverlay').style.display = 'flex';
    // Show the form stage immediately
    document.getElementById('stage-form').style.display = 'block';
    document.getElementById('stage-finalizing').style.display = 'none';
    
    document.getElementById('processor-title').innerText = "Delivery Details";
    document.getElementById('processor-msg').innerText = "Please provide your contact and delivery information to complete the booking.";
}

function cancelPayment() {
    document.getElementById('paymentOverlay').style.display = 'none';
}

function confirmPayment() {
    const phone = document.getElementById('contact_phone').value;
    const address = document.getElementById('delivery_address').value;
    const paymentMethod = document.querySelector('input[name="payment_method"]:checked').value;

    if (!phone || phone.trim().length < 10) {
        alert("Please enter a valid 10-digit mobile number.");
        return;
    }
    if (!address || address.trim().length < 5) {
        alert("Please enter a valid delivery address or venue name.");
        return;
    }

    // 1. Show Mock Payment Success
    alert("Payment Successful!");

    // 2. Prepare Booking Data
    const bookingData = {
        event_date: state.event_date,
        event_type_id: state.event_type_id,
        package_id: state.package_id,
        guests: state.guests,
        total_price: state.total,
        service_type: state.service_type,
        items: state.selected_items.map(i => i.id),
        notes: document.getElementById('notes').value,
        contact_phone: phone,
        delivery_address: address,
        payment_method: paymentMethod
    };

    // 3. Send request to Backend to store order
    document.getElementById('stage-form').style.display = 'none';
    document.getElementById('stage-finalizing').style.display = 'block';
    document.getElementById('processor-title').innerText = "Storing Order...";
    document.getElementById('processor-msg').innerText = "Please wait while we save your booking details.";

    fetch('/api/create-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // 4. Show Confirmation Message
            alert("Order Placed Successfully!");
            // 5. Redirect to Success Page (Invoice)
            window.location.href = `/invoice/${data.booking_id}`;
        } else {
            alert("Error: " + (data.message || "Could not save order."));
            document.getElementById('stage-form').style.display = 'block';
            document.getElementById('stage-finalizing').style.display = 'none';
        }
    })
    .catch(err => {
        console.error(err);
        alert("A technical error occurred. Please try again.");
        document.getElementById('stage-form').style.display = 'block';
        document.getElementById('stage-finalizing').style.display = 'none';
    });
}

// --- Smart Suggestions ---
function updateSuggestions() {
    const text = document.getElementById('suggestion_text');
    const count = state.selected_items.length;
    
    if (state.guests > 100 && count < 5) {
        text.innerText = "For over 100 guests, we suggest at least 5 menu items for variety.";
    } else if (count === 0) {
        text.innerText = "Start adding items to see your live quote!";
    } else {
        text.innerText = "Great choice! Your menu looks balanced.";
    }
}

// Initialize
updateQuotation();
