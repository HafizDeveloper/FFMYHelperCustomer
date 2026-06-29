const urlParams = new URLSearchParams(window.location.search);
const ticketId = urlParams.get('id');

let ws = null;
let reconnectTimer = null;

if (ticketId) {
    loadTicketDetails();
} else {
    window.location.href = '/';
}

function getRequestTypeLabel(type) {
    switch (type) {
        case 'ban_appeal': return 'Ban Appeal';
        case 'bug_report': return 'Bug Report';
        case 'feedback': return 'Feedback';
        case 'general_inquiry': return 'General Inquiry';
        case 'technical_issue': return 'Technical Issue';
        default: return type;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

async function loadTicketDetails() {
    try {
        const response = await fetch(`/api/tickets/${ticketId}`);
        if (!response.ok) {
            document.getElementById('loadingView').innerHTML = `
                <h3 style="color: #e3001b; margin-bottom: 20px;">Error: Ticket Not Found</h3>
                <p>Ticket ID <strong>${ticketId}</strong> does not exist in the system.</p>
                <a href="index.html" class="btn btn-primary mt-20">Back to Home</a>
            `;
            return;
        }

        const ticket = await response.json();

        document.getElementById('loadingView').style.display = 'none';
        document.getElementById('ticketView').style.display = 'grid';

        document.getElementById('usernameDisplay').innerText = ticket.nickname || ticket.uid;
        document.getElementById('createdTimeDisplay').innerText = formatDate(ticket.created_at);
        document.getElementById('ticketSubjectDisplay').innerText = getRequestTypeLabel(ticket.type);
        document.getElementById('ticketMessageDisplay').innerText = ticket.description;

        document.getElementById('sidebarRequester').innerText = ticket.nickname;
        document.getElementById('sidebarCreated').innerText = formatDate(ticket.created_at);
        document.getElementById('sidebarUpdated').innerText = formatDate(ticket.updated_at || ticket.created_at);
        document.getElementById('sidebarTicketId').innerText = ticket._id || ticket.ticket_id;

        updateStatusBadge(ticket.status);

        const mainList = document.getElementById('mainAttachmentsList');
        const sideList = document.getElementById('sidebarAttachmentsList');
        mainList.innerHTML = '';
        sideList.innerHTML = '';

        if (ticket.attachments && ticket.attachments.length > 0) {
            document.getElementById('mainAttachmentsSection').style.display = 'block';
            ticket.attachments.forEach(url => {
                const filename = url.split('/').pop();
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.className = 'attachment-link';
                link.innerHTML = `📄 ${filename}`;

                mainList.appendChild(link.cloneNode(true));
                sideList.appendChild(link);
            });
        } else {
            document.getElementById('mainAttachmentsSection').style.display = 'none';
        }

        const chatHistory = document.getElementById('chatMessages');
        chatHistory.innerHTML = '';
        if (ticket.messages && ticket.messages.length > 0) {
            ticket.messages.forEach(msg => {
                appendMessageBubble(msg.sender, msg.text, msg.timestamp);
            });
        } else {
            appendSystemBubble("Ticket created. Waiting for admin feedback.");
        }

        scrollToBottom();

        connectWebSocket();

    } catch (error) {
        console.error('Error fetching ticket:', error);
        document.getElementById('loadingView').innerHTML = `
            <h3 style="color: red; margin-bottom: 20px;">Network Error</h3>
            <p>Failed to connect to the database server.</p>
            <a href="index.html" class="btn btn-primary mt-20">Back to Home</a>
        `;
    }
}

function updateStatusBadge(status) {
    const badge = document.getElementById('ticketStatusBadge');
    badge.innerText = status;
    badge.className = 'status-badge';

    if (status === 'Solved') {
        badge.classList.add('status-solved');
    } else {
        badge.classList.add('status-open');
    }
}

function connectWebSocket() {
    if (ws) {
        ws.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws = new WebSocket(`${protocol}//${host}/ws/ticket/${ticketId}`);

    ws.onopen = () => {
        console.log('WebSocket connection opened');
        appendSystemBubble("Live Chat Active - Connected to Support");
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'message') {
            appendMessageBubble(data.sender, data.text, data.timestamp);
            scrollToBottom();

            const newStatus = data.sender === 'admin' ? 'Solved' : 'Open';
            updateStatusBadge(newStatus);
        } else if (data.type === 'status_update') {
            updateStatusBadge(data.status);
            appendSystemBubble(`Ticket status changed to: ${data.status}`);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket connection closed');
        appendSystemBubble("Connection lost. Reconnecting...");

        if (!reconnectTimer) {
            reconnectTimer = setTimeout(connectWebSocket, 3000);
        }
    };
}

function appendMessageBubble(sender, text, timestamp) {
    const chatMessages = document.getElementById('chatMessages');

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble bubble-${sender}`;

    const content = document.createElement('div');
    content.textContent = text;

    const meta = document.createElement('span');
    meta.className = 'message-meta';
    meta.textContent = `${sender === 'admin' ? 'Admin FF' : 'You'} • ${formatDate(timestamp)}`;

    bubble.appendChild(content);
    bubble.appendChild(meta);
    chatMessages.appendChild(bubble);
}

function appendSystemBubble(text) {
    const chatMessages = document.getElementById('chatMessages');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bubble-system';
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
}

function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChatMessage(event) {
    event.preventDefault();
    const chatInput = document.getElementById('chatInput');
    const text = chatInput.value.trim();

    if (text && ws && ws.readyState === WebSocket.OPEN) {
        const messagePayload = {
            sender: 'user',
            text: text
        };

        ws.send(JSON.stringify(messagePayload));
        chatInput.value = '';
        chatInput.focus();
    } else if (ws && ws.readyState !== WebSocket.OPEN) {
        alert('Reconnecting to server. Please wait...');
    }
}
