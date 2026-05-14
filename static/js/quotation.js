let state = {
    step: 1,
    guests: 50,
    food_category: 'Veg',
    veg_guests: 0,
    non_veg_guests: 0,
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
        if (state.food_category === 'Both') {
            if (state.veg_guests + state.non_veg_guests !== state.guests) {
                document.getElementById('both_guest_warning').style.display = 'block';
                return;
            } else {
                document.getElementById('both_guest_warning').style.display = 'none';
            }
        }
    }
    
    // Logic for Step 3: Initialize items if first time
    if (step === 3) {
        if (!state.menu_initialized) {
            initializeMenuState();
            state.menu_initialized = true;
        }
        renderCustomizeMenu();
    }
    
    document.querySelectorAll('.step-container').forEach(s => s.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');
    state.step = step;
}

function initializeMenuState() {
    const eventSelect = document.getElementById('event_type');
    const packageItemsStr = eventSelect.options[eventSelect.selectedIndex].dataset.packageItems || '';
    const packageItemIds = packageItemsStr.split(',').filter(id => id);

    state.selected_items = [];
    const menuData = document.querySelectorAll('.menu-item-source');
    
    menuData.forEach(itemEl => {
        const id = itemEl.dataset.id;
        const isPackage = packageItemIds.includes(id);
        const foodType = itemEl.dataset.foodType;

        // Filter based on food category
        if (state.food_category !== 'Both') {
            const currentType = state.food_category === 'Veg' ? 'veg' : 'non-veg';
            if (foodType !== currentType) return;
        }

        if (isPackage) {
            state.selected_items.push({
                id: id,
                name: itemEl.dataset.name,
                price: parseFloat(itemEl.dataset.price),
                quantity: state.guests,
                isPackage: true
            });
        }
    });
}

function renderCustomizeMenu() {
    const eventSelect = document.getElementById('event_type');
    const packageItemsStr = eventSelect.options[eventSelect.selectedIndex].dataset.packageItems || '';
    const packageItemIds = packageItemsStr.split(',').filter(id => id);

    const includedList = document.getElementById('included-items-list');
    const additionalList = document.getElementById('additional-items-list');
    
    includedList.innerHTML = '';
    additionalList.innerHTML = '';

    const menuData = document.querySelectorAll('.menu-item-source');

    menuData.forEach(itemEl => {
        const id = itemEl.dataset.id;
        const name = itemEl.dataset.name;
        const price = parseFloat(itemEl.dataset.price);
        const foodType = itemEl.dataset.foodType;
        const isPackage = packageItemIds.includes(id);

        // Filter based on food category
        if (state.food_category !== 'Both') {
            const currentType = state.food_category === 'Veg' ? 'veg' : 'non-veg';
            if (foodType !== currentType) return;
        }

        const selectedItem = state.selected_items.find(i => i.id === id);
        const isSelected = !!selectedItem;
        const quantity = selectedItem ? selectedItem.quantity : state.guests;

        const itemHtml = `
            <div class="menu-list-item ${isSelected ? 'selected' : ''}" data-id="${id}" style="border-left: 4px solid ${isSelected ? 'var(--primary)' : 'transparent'};">
                <div class="item-info">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleItemSelection('${id}', this.checked)" style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--primary);">
                    <div class="item-type-dot" style="background: ${foodType === 'veg' ? '#10b981' : '#ff4444'}"></div>
                    <div>
                        <div style="font-weight: 600; color: ${isSelected ? 'white' : 'var(--text-dim)'};">${name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-dim);">₹${price} / person</div>
                    </div>
                </div>
                ${isSelected ? `
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateItemQty('${id}', -10)"><i class="fas fa-minus"></i></button>
                    <span class="qty-val">${quantity}</span>
                    <button class="qty-btn" onclick="updateItemQty('${id}', 10)"><i class="fas fa-plus"></i></button>
                </div>
                ` : `
                <div style="color: var(--text-dim); font-size: 0.8rem;">Click to add</div>
                `}
            </div>
        `;

        if (isPackage) {
            includedList.insertAdjacentHTML('beforeend', itemHtml);
        } else {
            additionalList.insertAdjacentHTML('beforeend', itemHtml);
        }
    });

    updateQuotation();
}

function toggleItemSelection(id, checked) {
    if (checked) {
        const item = state.selected_items.find(i => i.id === id);
        if (!item) {
            const source = document.querySelector(`.menu-item-source[data-id="${id}"]`);
            const packageItemsStr = document.getElementById('event_type').options[document.getElementById('event_type').selectedIndex].dataset.packageItems || '';
            const isPackage = packageItemsStr.split(',').includes(id);
            
            state.selected_items.push({
                id: id,
                name: source.dataset.name,
                price: parseFloat(source.dataset.price),
                quantity: state.guests,
                isPackage: isPackage
            });
        }
    } else {
        state.selected_items = state.selected_items.filter(i => i.id !== id);
    }
    renderCustomizeMenu();
}

function updateItemQty(id, delta) {
    const item = state.selected_items.find(i => i.id === id);
    if (item) {
        item.quantity = Math.max(10, item.quantity + delta);
    }
    renderCustomizeMenu();
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
document.getElementById('event_type').addEventListener('change', function() {
    state.menu_initialized = false;
    updateQuotation();
});
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

document.getElementById('food_category').addEventListener('change', function(e) {
    state.food_category = e.target.value;
    state.menu_initialized = false;
    const bothSection = document.getElementById('both_guests_section');
    if (state.food_category === 'Both') {
        bothSection.style.display = 'block';
    } else {
        bothSection.style.display = 'none';
        state.veg_guests = 0;
        state.non_veg_guests = 0;
    }
});

document.getElementById('veg_guests').addEventListener('input', function(e) {
    state.veg_guests = parseInt(e.target.value) || 0;
    if (state.veg_guests + state.non_veg_guests === state.guests) {
        document.getElementById('both_guest_warning').style.display = 'none';
    }
});

document.getElementById('non_veg_guests').addEventListener('input', function(e) {
    state.non_veg_guests = parseInt(e.target.value) || 0;
    if (state.veg_guests + state.non_veg_guests === state.guests) {
        document.getElementById('both_guest_warning').style.display = 'none';
    }
});

// --- Package Selection ---
function selectPackage(id, name, pricePerGuest, el) {
    state.package_id = id;
    state.package_price = parseFloat(pricePerGuest);
    
    document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    
    updateQuotation();
}

function openPackageMenu() {
    const eventSelect = document.getElementById('event_type');
    const packageItemsStr = eventSelect.options[eventSelect.selectedIndex].dataset.packageItems || '';
    const packageItemIds = packageItemsStr.split(',').filter(id => id);
    
    if (packageItemIds.length === 0) {
        alert("No default items set for this event type yet.");
        return;
    }
    
    const eventName = eventSelect.options[eventSelect.selectedIndex].text;
    document.getElementById('packageMenuTitle').innerText = eventName + " Package Menu";
    
    const listContainer = document.getElementById('packageMenuList');
    listContainer.innerHTML = '';
    
    packageItemIds.forEach(id => {
        const itemEl = document.querySelector(`.menu-item-source[data-id="${id}"]`);
        if (!itemEl) return;
        
        const name = itemEl.dataset.name;
        const foodType = itemEl.dataset.foodType;

        const div = document.createElement('div');
        div.style.background = 'rgba(255,255,255,0.05)';
        div.style.padding = '0.8rem 1rem';
        div.style.borderRadius = '10px';
        div.style.border = '1px solid rgba(255,255,255,0.1)';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '0.5rem';
        
        const dot = document.createElement('span');
        dot.style.width = '8px';
        dot.style.height = '8px';
        dot.style.borderRadius = '50%';
        dot.style.background = foodType === 'veg' ? '#10b981' : '#ff4444';
        dot.style.display = 'inline-block';
        
        const text = document.createElement('span');
        text.innerText = name;
        text.style.color = 'white';
        text.style.fontSize = '0.95rem';
        
        div.appendChild(dot);
        div.appendChild(text);
        listContainer.appendChild(div);
    });
    
    document.getElementById('packageMenuOverlay').style.display = 'flex';
}

function closePackageMenu() {
    document.getElementById('packageMenuOverlay').style.display = 'none';
}

// --- Menu Customization ---


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
    state.selected_items.forEach(item => {
        foodCost += (item.price * item.quantity);
    });
    
    state.event_type_id = eventSelect.value;
    
    const serviceMultipliers = {
        'Normal': 0.0,
        'Buffet Setup': 0.15,
        'Live Cooking': 0.25
    };
    const multiplier = 1 + (serviceMultipliers[state.service_type] || 0);
    
    const packageBase = state.package_price || 0;
    const guestCount = state.guests || 0;
    
    const subtotal = ((eventBase + packageBase) * guestCount + foodCost) * multiplier;
    const gst = subtotal * 0.18;
    const total = subtotal + gst;
    
    state.total = total;

    // Update UI
    const safeSetText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    safeSetText('price_base', `₹${eventBase.toLocaleString()}`);
    safeSetText('price_food', `₹${(packageBase * guestCount + foodCost).toLocaleString()}`);
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
        food_category: state.food_category,
        veg_guests: state.veg_guests,
        non_veg_guests: state.non_veg_guests,
        total_price: state.total,
        service_type: state.service_type,
        items: state.selected_items.map(i => ({id: i.id, quantity: i.quantity})),
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
