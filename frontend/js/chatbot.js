function toggleChat() {
    const window = document.getElementById('chat-window');
    const display = window.style.display;
    window.style.display = display === 'none' ? 'flex' : 'none';
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    appendMessage('user', msg);
    input.value = '';

    // Simple AI Simulation (Keyword matching)
    setTimeout(() => {
        const response = getBotResponse(msg.toLowerCase());
        appendMessage('bot', response);
    }, 500);
}

function appendMessage(sender, text) {
    const container = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    
    if (sender === 'user') {
        msgDiv.style.cssText = "align-self: flex-end; background: var(--primary); color: white; padding: 0.8rem 1rem; border-radius: 15px 15px 0 15px; max-width: 80%; font-size: 0.9rem;";
    } else {
        msgDiv.style.cssText = "align-self: flex-start; background: rgba(255,255,255,0.05); padding: 0.8rem 1rem; border-radius: 15px 15px 15px 0; border: 1px solid var(--glass-border); max-width: 80%; font-size: 0.9rem;";
    }
    
    msgDiv.innerText = text;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function getBotResponse(input) {
    if (input.includes('refund') || input.includes('cancel')) {
        return "You can cancel any booking within 24 hours of placing it. Refunds are initiated immediately and usually take 5-7 working days to reflect.";
    }
    if (input.includes('price') || input.includes('cost') || input.includes('quotation')) {
        return "Our pricing depends on the event type, package, and number of guests. You can get an instant live quotation on the 'Book Now' page!";
    }
    if (input.includes('menu') || input.includes('food')) {
        return "We offer 4 distinct categories: Starters, Main Course, Desserts, and Drinks. You can fully customize your menu during the booking process.";
    }
    if (input.includes('location') || input.includes('address')) {
        return "We serve the entire city and surrounding suburbs! Delivery charges may apply based on your distance from our central kitchen.";
    }
    if (input.includes('contact') || input.includes('phone') || input.includes('call')) {
        return "You can reach our support team at +91 98765 43210 or email us at support@planora.com.";
    }
    if (input.includes('hello') || input.includes('hi')) {
        return "Hello! How can I help you with your event planning today?";
    }
    return "I'm still learning! Could you please rephrase that or ask about refunds, pricing, menu, or locations?";
}
