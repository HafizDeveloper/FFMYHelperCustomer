<<<<<<< HEAD
document.addEventListener('DOMContentLoaded', () => {
    const profileToggle = document.getElementById('profileToggle');
    const profileDropdown = document.getElementById('profileDropdown');
    const signOutBtn = document.getElementById('signOutBtn');

    // Toggle Dropdown on Avatar Click
    profileToggle.addEventListener('click', (e) => {
        // Only toggle if we didn't click inside the dropdown itself
        if (!profileDropdown.contains(e.target)) {
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        }
    });

    // Close Dropdown when clicking outside
    window.addEventListener('click', (e) => {
        if (!profileToggle.contains(e.target)) {
            profileDropdown.classList.remove('show');
        }
    });

    // Sign Out logic
    if (signOutBtn) {
        signOutBtn.addEventListener('click', (e) => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'login.html';
        });
    }
=======
document.addEventListener('DOMContentLoaded', () => {
    const profileToggle = document.getElementById('profileToggle');
    const profileDropdown = document.getElementById('profileDropdown');
    const signOutBtn = document.getElementById('signOutBtn');

    // Toggle Dropdown on Avatar Click
    profileToggle.addEventListener('click', (e) => {
        // Only toggle if we didn't click inside the dropdown itself
        if (!profileDropdown.contains(e.target)) {
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        }
    });

    // Close Dropdown when clicking outside
    window.addEventListener('click', (e) => {
        if (!profileToggle.contains(e.target)) {
            profileDropdown.classList.remove('show');
        }
    });

    // Sign Out logic
    if (signOutBtn) {
        signOutBtn.addEventListener('click', (e) => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'login.html';
        });
    }
>>>>>>> 0d2c8ec (first commit)
});