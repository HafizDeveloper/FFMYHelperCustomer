<<<<<<< HEAD
const revealEls = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('visible'), i * 80);
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.08 });
revealEls.forEach(el => observer.observe(el));

const languageSelector = document.getElementById('languageSelector');
if (languageSelector) {
    const storedLang = localStorage.getItem('appLang') || 'en';
    languageSelector.value = storedLang;

    languageSelector.addEventListener('change', function () {
        const selectedLang = this.value;
        localStorage.setItem('appLang', selectedLang);
    });
}

async function checkLoginAndRedirectToSubmit() {
    const response = await fetch('/api/current_user', { credentials: 'include' });
    const user = await response.json();
    if (user) {
        window.location.href = 'submit.html?type=feedback';
    } else {
        alert('Sila log masuk terlebih dahulu untuk menghantar tiket.');
    }
}

function handleSocialLogin(provider) {
    window.location.href = `/auth/${provider.toLowerCase()}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'login_failed') {
        alert('Log masuk gagal. Sila cuba lagi.');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const profileToggle = document.getElementById('profileToggle');
    const profileDropdown = document.getElementById('profileDropdown');
    const signOutBtn = document.getElementById('signOutBtn');

    // Pindahkan listener ke atas supaya dropdown boleh dibuka segera
    if (profileToggle && profileDropdown) {
        profileToggle.addEventListener('click', (e) => {
            // Hanya toggle jika yang ditekan bukan dalam dropdown (seperti butang)
            const isDropdownContent = profileDropdown.contains(e.target);
            if (!isDropdownContent) {
                e.stopPropagation();
                profileDropdown.classList.toggle('show');
            }
        });

        window.addEventListener('click', (e) => {
            if (!profileToggle.contains(e.target)) {
                profileDropdown.classList.remove('show');
            }
        });
    }

    // Proses data pengguna dalam blok try-catch agar tidak merosakkan UI jika gagal
    try {
        const response = await fetch('/api/current_user', { credentials: 'include' });
        const user = await response.json();

        if (user) {
            const userNameText = document.querySelector('.user-name');
            const userAvatar = document.querySelector('.nav-user-avatar');
            const loginSection = document.querySelector('.dropdown-login-section');

            if (userNameText) userNameText.textContent = user.name;
            if (userAvatar) {
                userAvatar.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--gold);">${user.name.charAt(0)}</div>`;
                userAvatar.style.backgroundColor = 'transparent';
            }
            if (loginSection) loginSection.style.display = 'none';
        } else {
            const myRequestsLink = document.querySelector('a[href="my-tickets.html"]');
            if (myRequestsLink) myRequestsLink.style.display = 'none';
        }
    } catch (err) {
        console.log("Not logged in or server offline");
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            window.location.href = '/auth/logout';
        });
    }
=======
const revealEls = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('visible'), i * 80);
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.08 });
revealEls.forEach(el => observer.observe(el));

const languageSelector = document.getElementById('languageSelector');
if (languageSelector) {
    const storedLang = localStorage.getItem('appLang') || 'en';
    languageSelector.value = storedLang;

    languageSelector.addEventListener('change', function () {
        const selectedLang = this.value;
        localStorage.setItem('appLang', selectedLang);
    });
}

async function checkLoginAndRedirectToSubmit() {
    const response = await fetch('/api/current_user', { credentials: 'include' });
    const user = await response.json();
    if (user) {
        window.location.href = 'submit.html?type=feedback';
    } else {
        alert('Sila log masuk terlebih dahulu untuk menghantar tiket.');
    }
}

function handleSocialLogin(provider) {
    window.location.href = `/auth/${provider.toLowerCase()}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'login_failed') {
        alert('Log masuk gagal. Sila cuba lagi.');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const profileToggle = document.getElementById('profileToggle');
    const profileDropdown = document.getElementById('profileDropdown');
    const signOutBtn = document.getElementById('signOutBtn');

    // Pindahkan listener ke atas supaya dropdown boleh dibuka segera
    if (profileToggle && profileDropdown) {
        profileToggle.addEventListener('click', (e) => {
            // Hanya toggle jika yang ditekan bukan dalam dropdown (seperti butang)
            const isDropdownContent = profileDropdown.contains(e.target);
            if (!isDropdownContent) {
                e.stopPropagation();
                profileDropdown.classList.toggle('show');
            }
        });

        window.addEventListener('click', (e) => {
            if (!profileToggle.contains(e.target)) {
                profileDropdown.classList.remove('show');
            }
        });
    }

    // Proses data pengguna dalam blok try-catch agar tidak merosakkan UI jika gagal
    try {
        const response = await fetch('/api/current_user', { credentials: 'include' });
        const user = await response.json();

        if (user) {
            const userNameText = document.querySelector('.user-name');
            const userAvatar = document.querySelector('.nav-user-avatar');
            const loginSection = document.querySelector('.dropdown-login-section');

            if (userNameText) userNameText.textContent = user.name;
            if (userAvatar) {
                userAvatar.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--gold);">${user.name.charAt(0)}</div>`;
                userAvatar.style.backgroundColor = 'transparent';
            }
            if (loginSection) loginSection.style.display = 'none';
        } else {
            const myRequestsLink = document.querySelector('a[href="my-tickets.html"]');
            if (myRequestsLink) myRequestsLink.style.display = 'none';
        }
    } catch (err) {
        console.log("Not logged in or server offline");
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            window.location.href = '/auth/logout';
        });
    }
>>>>>>> 0d2c8ec (first commit)
});