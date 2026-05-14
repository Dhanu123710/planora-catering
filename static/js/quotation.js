let state = {
    step: 1,
    guests: 50,
    event_type_id: null,
    package_id: null,
    package_price: 0, // Store package base price
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
document.getElementById('eventDate').addEventListener('change', function(e) {
    const date = e.target.value;
    if (!date) return;
    
    state.event_date = date;
    const msgEl = document.getElementById('availability_msg');
    const btn = document.getElementById('btnStep1');
    
    // Robust date validation (YYYY-MM-DD parsing to local date)
    const parts = date.split('-');
    const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
    selectedDate.setHours(0,0,0,0);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = selectedDate - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        msgEl.innerText = "❌ Cannot book events for past dates.";
        msgEl.style.color = "#ff4444";
        btn.disabled = true;
        return;
    }
    
    if (diffDays < 15) {
        const minDate = new Date(today.getTime() + 15 * 86400000);
        msgEl.innerText = "❌ Booking must be made at least 15 days in advance (Earliest: " + minDate.toDateString() + ").";
        msgEl.style.color = "#ff4444";
        btn.disabled = true;
        return;
    }

    if (diffDays > 180) {
        const maxDate = new Date(today.getTime() + 180 * 86400000);
        msgEl.innerText = "❌ Booking cannot be made more than 6 months in advance (Latest: " + maxDate.toDateString() + ").";
        msgEl.style.color = "#ff4444";
        btn.disabled = true;
        return;
    }

    if (state.guests < 10) {
        msgEl.innerText = "⚠️ Please enter at least 10 guests first.";
        msgEl.style.color = "#ffc107";
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
        })
        .catch(err => {
            console.error(err);
            msgEl.innerText = "❌ Connection error. Try again.";
        });
});

// --- Event & Guest Listeners ---
document.getElementById('event_type').addEventListener('change', updateQuotation);
document.getElementById('guests').addEventListener('input', function(e) {
    state.guests = parseInt(e.target.value) || 0;
    
    if (state.guests >= 10) {
        document.getElementById('guest_warning').style.display = 'none';
        // If they have a date selected, re-trigger the date change logic to enable button
        const dateInput = document.getElementById('eventDate');
        if (dateInput.value) {
            dateInput.dispatchEvent(new Event('change'));
        }
    } else {
        document.getElementById('guest_warning').style.display = 'block';
        document.getElementById('btnStep1').disabled = true;
    }
    
    const summaryGuests = document.getElementById('summary_guests');
    if (summaryGuests) summaryGuests.innerText = state.guests;
    
    updateQuotation();
    if (typeof updateSuggestions === 'function') updateSuggestions();
});

// --- Package Selection ---
function selectPackage(id, name, pricePerGuest, el) {
    state.package_id = id;
    state.package_price = parseFloat(pricePerGuest);
    
    document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    
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
    console.log("Updating Quotation...", state);
    const eventSelect = document.getElementById('event_type');
    if (!eventSelect || eventSelect.selectedIndex === -1) {
        console.warn("Event select not ready");
        return;
    }

    const selectedOption = eventSelect.options[eventSelect.selectedIndex];
    const eventBase = parseFloat(selectedOption.dataset.price) || 0;
    const eventName = selectedOption.text;
    
    let foodCost = 0;
    state.selected_items.forEach(item => foodCost += item.price);
    
    state.event_type_id = eventSelect.value;
    
    const serviceMultipliers = {
        'Normal': 0.0,
        'Buffet Setup': 0.15,
        'Live Cooking': 0.25
    };
    const multiplier = 1 + (serviceMultipliers[state.service_type] || 0);
    
    const packageBase = state.package_price || 0;
    const guestCount = state.guests || 0;
    
    const subtotal = ((eventBase + packageBase + foodCost) * guestCount) * multiplier;
    const gst = subtotal * 0.18;
    const total = subtotal + gst;
    
    state.total = total;

    // Update UI
    const safeSetText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    safeSetText('price_base', `₹${eventBase.toLocaleString()}`);
    safeSetText('price_food', `₹${(packageBase + foodCost).toLocaleString()}`);
    safeSetText('price_service', state.service_type === 'Normal' ? 'Included' : `+${(serviceMultipliers[state.service_type]*100)}%`);
    safeSetText('price_subtotal', `₹${subtotal.toLocaleString()}`);
    safeSetText('price_gst', `₹${gst.toLocaleString()}`);
    safeSetText('price_total', `₹${total.toLocaleString()}`);
    safeSetText('summary_guests', guestCount);
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

    const payBtn = document.querySelector('button[onclick="confirmPayment()"]');
    if (payBtn) payBtn.disabled = true;

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
            if (payBtn) payBtn.disabled = false;
        }
    })
    .catch(err => {
        console.error(err);
        alert("A technical error occurred. Please try again.");
        document.getElementById('stage-form').style.display = 'block';
        document.getElementById('stage-finalizing').style.display = 'none';
        if (payBtn) payBtn.disabled = false;
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
document.addEventListener('DOMContentLoaded', function() {
    // Read initial values from DOM
    const guestsInput = document.getElementById('guests');
    if (guestsInput) state.guests = parseInt(guestsInput.value) || 50;
    
    updateQuotation();
    if (typeof updateSuggestions === 'function') updateSuggestions();
});
