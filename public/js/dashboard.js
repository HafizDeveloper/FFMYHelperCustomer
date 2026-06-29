let tickets = [];
let activeTicket = null;
let currentFilter = 'all';
let ws = null;

// Initial fetch
fetchTickets();

// Periodically refresh ticket list in background (every 10 seconds)
setInterval(fetchTickets, 10000);

async function fetchTickets() {
    try {
        let url = '/api/tickets';
        if (currentFilter !== 'all') {
            url += `?status=${currentFilter}`;
        }

        const response = await fetch(url);
        if (response.ok) {
            tickets = await response.json();
            renderTicketList();
        }
    } catch (error) {
        console.error('Error fetching tickets:', error);
    }
}

function filterTickets(status) {
    currentFilter = status;

    // Update active class on filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (status === 'all') document.getElementById('filter-all').classList.add('active');
    if (status === 'Open') document.getElementById('filter-open').classList.add('active');
    if (status === 'Solved') document.getElementById('filter-solved').classList.add('active');

    fetchTickets();
}

function renderTicketList() {
    const listDiv = document.getElementById('ticketItems');
    listDiv.innerHTML = '';

    if (tickets.length === 0) {
        listDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #666666;">No tickets found.</p>';
        return;
    }

    tickets.forEach(ticket => {
        const item = document.createElement('div');
        item.className = `ticket-item ${activeTicket && activeTicket.ticket_id === ticket.ticket_id ? 'active' : ''}`;
        item.onclick = () => selectTicket(ticket.ticket_id);

        const requestTypeLabel = getRequestTypeLabel(ticket.type);
        const formattedDate = formatDate(ticket.created_at);

        // Status indicator text/class
        const statusBadgeClass = ticket.status === 'Solved' ? 'status-solved' : 'status-open';
        const dotColor = ticket.status === 'Solved' ? '#22c55e' : '#f59e0b';

        item.innerHTML = `
            <div class="ticket-item-header">
                <span class="ticket-item-id">${ticket.ticket_id}</span>
                <span class="status-badge ${statusBadgeClass}">${ticket.status}</span>
            </div>
            <div class="ticket-item-title">${ticket.nickname} (${ticket.uid})</div>
            <div class="ticket-item-meta"><span style="color:${dotColor}">●</span> ${requestTypeLabel} • ${formattedDate}</div>
        `;

        listDiv.appendChild(item);
    });
}

async function selectTicket(ticketId) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}`);
        if (!response.ok) {
            alert('Failed to fetch ticket details.');
            return;
        }

        activeTicket = await response.json();

        // Mark active item in list
        document.querySelectorAll('.ticket-item').forEach(item => {
            item.classList.remove('active');
        });
        renderTicketList(); // re-render list to show active background

        // Show view, hide placeholder
        document.getElementById('detailPlaceholder').style.display = 'none';
        document.getElementById('activeTicketView').style.display = 'flex';

        // Render Details
        document.getElementById('activeTicketId').innerText = activeTicket.ticket_id;
        document.getElementById('activeTicketDate').innerText = formatDate(activeTicket.created_at);
        document.getElementById('activeTicketUid').innerText = activeTicket.uid;
        document.getElementById('activeTicketNickname').innerText = activeTicket.nickname;
        document.getElementById('activeTicketType').innerText = getRequestTypeLabel(activeTicket.type);
        document.getElementById('activeTicketDesc').innerText = activeTicket.description;

        updateActiveStatusBadge(activeTicket.status);

        // Render attachments
        // ... (existing attachment rendering logic)
        const attachmentsSec = document.getElementById('activeTicketAttachments');
        const attachmentsList = document.getElementById('activeTicketAttachmentsList');
        attachmentsList.innerHTML = '';

        if (activeTicket.attachments && activeTicket.attachments.length > 0) {
            attachmentsSec.style.display = 'block';
            activeTicket.attachments.forEach(file => {
                const link = document.createElement('a');
                link.href = file.path;
                link.className = 'attachment-link';
                link.target = '_blank';
                link.download = file.filename;

                const isImage = file.mime_type && file.mime_type.startsWith('image/');
                const isVideo = file.mime_type && file.mime_type.startsWith('video/');
                let icon = '📄';
                if (isImage) icon = '🖼️';
                if (isVideo) icon = '🎥';

                link.innerHTML = `<span>${icon}</span> <span>${file.filename}</span>`;
                attachmentsList.appendChild(link);
            });
        } else {
            attachmentsSec.style.display = 'none';
        }

        // Chat messages load
        const chatMessages = document.getElementById('adminChatMessages');
        chatMessages.innerHTML = '';

        if (activeTicket.messages && activeTicket.messages.length > 0) {
            activeTicket.messages.forEach(msg => {
                appendAdminMessageBubble(msg.sender, msg.text, msg.timestamp);
            });
        } else {
            appendAdminSystemBubble("New ticket opened. Please reply to assist the user.");
        }

        scrollAdminChatToBottom();

        // WebSocket Connect for active ticket
        // ... (existing WebSocket connection logic)
        connectAdminWebSocket(ticketId);

        // Add delete button
        addDeleteButton(ticketId);

    } catch (error) {
        console.error('Error selecting ticket:', error);
    }
}

function updateActiveStatusBadge(status) {
    const badge = document.getElementById('activeTicketStatusBadge');
    badge.innerText = status;
    badge.className = 'status-badge';

    const toggleBtn = document.getElementById('toggleStatusBtn');

    if (status === 'Solved') {
        badge.classList.add('status-solved');
        toggleBtn.innerText = "Switch to Open";
    } else {
        badge.classList.add('status-open');
        toggleBtn.innerText = "Switch to Solved";
    }
}

async function toggleTicketStatus() {
    if (!activeTicket) return;

    const newStatus = activeTicket.status === 'Solved' ? 'Open' : 'Solved';

    try {
        const response = await fetch(`/api/tickets/${activeTicket.ticket_id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            activeTicket.status = newStatus;
            updateActiveStatusBadge(newStatus);
            fetchTickets(); // Refresh list to show updated status

            // Notify via WebSocket
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'status_update',
                    status: newStatus
                }));
            }
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

async function deleteTicket(ticketId) {
    if (!confirm(`Are you sure you want to delete ticket ${ticketId}? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Basic ' + btoa('admin:admin123') // Replace with actual admin credentials or a more secure method
            }
        });

        if (response.ok) {
            alert(`Ticket ${ticketId} deleted successfully.`);
            activeTicket = null; // Clear active ticket
            document.getElementById('activeTicketView').style.display = 'none';
            document.getElementById('detailPlaceholder').style.display = 'flex';
            fetchTickets(); // Refresh the ticket list
            if (ws) ws.close(); // Close WebSocket if open for this ticket
        } else {
            const errorData = await response.json();
            alert(`Failed to delete ticket: ${errorData.detail || response.statusText}`);
        }
    } catch (error) {
        console.error('Error deleting ticket:', error);
        alert('Network error while trying to delete ticket.');
    }
}



function connectAdminWebSocket(ticketId) {
    if (ws) {
        ws.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws = new WebSocket(`${protocol}//${host}/ws/ticket/${ticketId}`);

    ws.onopen = () => {
        console.log('Admin WebSocket connected for:', ticketId);
        appendAdminSystemBubble("Live Chat Active - You are acting as Admin");
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'message') {
            appendAdminMessageBubble(data.sender, data.text, data.timestamp);
            scrollAdminChatToBottom();

            // Auto update UI status
            const newStatus = data.sender === 'admin' ? 'Solved' : 'Open';
            activeTicket.status = newStatus;
            updateActiveStatusBadge(newStatus);
            fetchTickets(); // Refresh list
        } else if (data.type === 'status_update') {
            activeTicket.status = data.status;
            updateActiveStatusBadge(data.status);
            appendAdminSystemBubble(`Ticket status changed to: ${data.status}`);
            fetchTickets();
        }
    };

    ws.onclose = () => {
        console.log('Admin WebSocket closed');
        const chatMessages = document.getElementById('adminChatMessages');
        chatMessages.innerHTML += `<div class="chat-bubble bubble-system">System: Connected to Secure Line</div>`;
    };

    ws.onerror = (error) => {
        console.error('Admin WebSocket error:', error);
    };
}

function appendAdminMessageBubble(sender, text, timestamp) {
    const chatMessages = document.getElementById('adminChatMessages');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble bubble-${sender}`;

    const content = document.createElement('div');
    content.textContent = text;

    const meta = document.createElement('span');
    meta.className = 'message-meta';
    meta.textContent = `${sender === 'admin' ? 'You (Admin)' : 'User'} • ${formatDate(timestamp)}`;

    bubble.appendChild(content);
    bubble.appendChild(meta);
    chatMessages.appendChild(bubble);
}

function appendAdminSystemBubble(text) {
    const chatMessages = document.getElementById('adminChatMessages');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bubble-system';
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
}

function scrollAdminChatToBottom() {
    const chatMessages = document.getElementById('adminChatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendAdminChatMessage(event) {
    event.preventDefault();
    const chatInput = document.getElementById('adminChatInput');
    const text = chatInput.value.trim();

    if (text && ws && ws.readyState === WebSocket.OPEN) {
        const messagePayload = {
            sender: 'admin',
            text: text
        };

        ws.send(JSON.stringify(messagePayload));
        chatInput.value = '';
        chatInput.focus();
    } else if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Ralat: Sambungan ke pelayan terputus. Sila muat semula halaman atau pilih semula tiket.');
    }
}

function addDeleteButton(ticketId) {
    const detailHeader = document.querySelector('#activeTicketView .detail-header');
    let deleteBtn = detailHeader.querySelector('.btn-delete');
    if (!deleteBtn) {
        deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.textContent = 'Delete Ticket';
        detailHeader.appendChild(deleteBtn);
    }
    deleteBtn.onclick = () => deleteTicket(ticketId);
}

// Helpers
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
