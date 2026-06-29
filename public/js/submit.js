async function checkAuth() {
    const response = await fetch('/api/current_user', { credentials: 'include' });
    const user = await response.json();
    if (!user) {
        alert('Sila log masuk menggunakan akaun Google atau Facebook terlebih dahulu sebelum membuat laporan.');
        window.location.href = '/';
    } else {
        // Auto-fill nama pengguna ke dalam input Nickname
        const nicknameInput = document.getElementById('nickname');
        if (nicknameInput && !nicknameInput.value) {
            nicknameInput.value = user.name;
        }
    }
}
checkAuth();

let selectedFiles = [];

const urlParams = new URLSearchParams(window.location.search);
const typeParam = urlParams.get('type');

const requestTypeSelect = document.getElementById('requestTypeSelect');
const banScreenshotGroup = document.getElementById('banScreenshotGroup');
const banScreenshotCheckbox = document.getElementById('banScreenshot');
const formSubtitle = document.getElementById('formSubtitle');

function updateRequestTypeUI() {
    const selectedValue = requestTypeSelect.value;
    const selectedText = requestTypeSelect.options[requestTypeSelect.selectedIndex].text;

    formSubtitle.innerText = `Submit ${selectedText}`;
    document.title = `Submit ${selectedText} - Free Fire Malaysia`;

    if (selectedValue === 'ban_appeal') {
        if (banScreenshotGroup) banScreenshotGroup.style.display = 'flex';
        if (banScreenshotCheckbox) banScreenshotCheckbox.required = true;
    } else {
        if (banScreenshotGroup) banScreenshotGroup.style.display = 'none';
        if (banScreenshotCheckbox) banScreenshotCheckbox.required = false;
        if (banScreenshotCheckbox) banScreenshotCheckbox.checked = false;
    }
}

if (typeParam && requestTypeSelect.querySelector(`option[value="${typeParam}"]`)) {
    requestTypeSelect.value = typeParam;
} else {
    requestTypeSelect.value = 'feedback';
}
updateRequestTypeUI();

requestTypeSelect.addEventListener('change', updateRequestTypeUI);

const descriptionArea = document.getElementById('description');
if (descriptionArea) {
    descriptionArea.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

const uploadContainer = document.querySelector('.upload-container');

['dragenter', 'dragover'].forEach(eventName => {
    uploadContainer.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadContainer.classList.add('upload-dragover');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadContainer.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadContainer.classList.remove('upload-dragover');
    }, false);
});

uploadContainer.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    addFiles(files);
});

function handleFileSelection(event) {
    const files = event.target.files;
    addFiles(files);
}

function addFiles(filesList) {
    const files = Array.from(filesList);

    if (selectedFiles.length + files.length > 5) {
        alert("You can only upload a maximum of 5 files.");
        return;
    }

    for (let file of files) {
        const fileType = file.type;
        const fileSize = file.size;

        const isVideo = fileType.startsWith('video/');
        const limit = isVideo ? 30 * 1024 * 1024 : 10 * 1024 * 1024;
        const limitStr = isVideo ? '30MB' : '10MB';

        if (fileSize > limit) {
            alert(`File "${file.name}" exceeds the size limit (${limitStr}).`);
            continue;
        }

        let totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0) + fileSize;
        if (totalSize > 50 * 1024 * 1024) {
            alert("Total file size exceeds the 50MB limit.");
            return;
        }

        if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    }

    renderFileList();
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
}

function renderFileList() {
    const fileListDiv = document.getElementById('fileList');
    fileListDiv.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';

        const preview = document.createElement('div');
        preview.className = 'file-preview';

        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.className = 'file-preview';
            img.style.marginBottom = '0';
            // preview.innerHTML = ''; // No need to clear, just replace
            preview.appendChild(img);
        } else {
            preview.textContent = file.type.startsWith('video/') ? '🎥' : '📄';
        }

        const nameSpan = document.createElement('div');
        nameSpan.className = 'file-item-name';
        nameSpan.textContent = file.name;

        const removeLink = document.createElement('span');
        removeLink.className = 'file-item-remove';
        removeLink.textContent = '✕';
        removeLink.onclick = () => removeFile(index);

        item.appendChild(preview);
        item.appendChild(nameSpan);
        item.appendChild(removeLink);
        fileListDiv.appendChild(item);
    });
}

async function submitTicket(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');

    submitBtn.textContent = 'Uploading...';
    submitBtn.disabled = true;
    submitBtn.classList.add('btn-disabled');

    if (progressContainer) progressContainer.style.display = 'block';

    const uid = document.getElementById('uid').value.trim();
    const nickname = document.getElementById('nickname').value.trim();
    const description = document.getElementById('description').value.trim();
    const privacyPolicy = document.getElementById('privacyPolicy').checked;

    const selectedRequestType = requestTypeSelect.value;

    const banScreenshot = selectedRequestType === 'ban_appeal' ? banScreenshotCheckbox.checked : false;

    const formData = new FormData();
    formData.append('uid', uid);
    formData.append('nickname', nickname);
    formData.append('request_type', selectedRequestType);
    formData.append('description', description);
    formData.append('privacy_policy', privacyPolicy);
    formData.append('ban_screenshot', banScreenshot);

    selectedFiles.forEach(file => {
        formData.append('files', file);
    });

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            if (progressBar) progressBar.style.width = percent + '%';
            if (percent < 100) {
                submitBtn.textContent = `Sending ${percent}%...`;
            } else {
                submitBtn.textContent = `Processing...`;
            }
        }
    });

    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            window.location.href = 'my-tickets.html';
        } else {
            let errorDetail = 'Failed to submit ticket.';
            try {
                const errorJson = JSON.parse(xhr.responseText);
                errorDetail = errorJson.detail || errorDetail;
            } catch (e) {
                errorDetail = `Server Error (${xhr.status})`;
            }
            handleError(errorDetail);
        }
    };

    xhr.onerror = function () {
        handleError('Network connection error. Please check your connection.');
    };

    function handleError(msg) {
        alert(`Error: ${msg}`);
        submitBtn.textContent = 'Submit Request';
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-disabled');
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
    }

    xhr.open('POST', '/api/ticket');
    xhr.withCredentials = true;
    xhr.send(formData);
}

function showSuccessToast(ticketId) {
    const toast = document.getElementById("toast");
    const notifTicketId = document.getElementById('notifTicketId');
    const notifViewTicketBtn = document.getElementById('notifViewTicketBtn');

    if (notifTicketId) notifTicketId.textContent = ticketId;
    if (notifViewTicketBtn) notifViewTicketBtn.href = `ticket.html?id=${ticketId}`;

    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}
