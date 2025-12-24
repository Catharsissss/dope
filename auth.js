// Global variables for authentication
let verificationData = {
  code: '',
  email: '',
  timestamp: null
};
let countdownInterval = null;

// ====================== HELPER FUNCTIONS ======================

// Email validation
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validatePassword(password) {
  if (password.length < 6) return 'Minimum 6 characters';
  if (!/[A-Z]/.test(password)) return 'Add an uppercase letter';
  if (!/\d/.test(password)) return 'Add a digit';
  return null;
}

function showError(element, message) {
  if (!element || !element.id) return;
  const errorElement = document.getElementById(`${element.id}Error`);
  if (!errorElement) return;

  element.classList.add('error');
  errorElement.textContent = message;
  errorElement.style.display = 'block';
}

function hideError(element) {
  if (!element || !element.id) return;
  const errorElement = document.getElementById(`${element.id}Error`);
  if (!errorElement) return;

  element.classList.remove('error');
  errorElement.style.display = 'none';
}

function showToastMessage(message, isSuccess = true) {
  const toast = document.createElement('div');
  toast.className = `toast-message ${isSuccess ? 'success' : 'error'}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }, 100);
}

// ====================== USER STORAGE ======================

function getUsersFromStorage() {
  return JSON.parse(localStorage.getItem('users')) || [];
}

function saveUserToStorage(user) {
  const users = getUsersFromStorage();
  users.push(user);
  localStorage.setItem('users', JSON.stringify(users));
}

function findUserByEmail(email) {
  const users = getUsersFromStorage();
  return users.find(user => user.email.toLowerCase() === email.toLowerCase());
}

// ====================== AUTHENTICATION ======================
function createLogoutConfirmationModal() {
  const modal = document.createElement('div');
  modal.id = 'logoutConfirmationModal';
  modal.className = 'logout-confirmation-modal';

  modal.innerHTML = `
    <div class="logout-confirmation-content">
      <span class="close-logout-modal">&times;</span>
      <h3>Are you sure you want to log out?</h3>
      <div class="confirmation-buttons">
        <button class="confirm-btn">Log Out</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Обработчики событий
  modal.querySelector('.close-logout-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.querySelector('.cancel-btn').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.querySelector('.confirm-btn').addEventListener('click', () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user');
    modal.style.display = 'none';
    window.location.href = 'index.html';
  });

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  return modal;
}

function checkAuthState() {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const profileIcon = document.querySelector('.profile-icon');
  const profileDropdown = document.querySelector('.profile-dropdown');

  if (!profileIcon) return;

  if (isLoggedIn) {
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const nameEl = document.querySelector('.profile-name');
    const emailEl = document.querySelector('.profile-email');
    if (nameEl && user.name) nameEl.textContent = user.name;
    if (emailEl && user.email) emailEl.textContent = user.email;
    profileIcon.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="currentColor"/>
        <path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    const userNameElement = document.querySelector('.user-name');
    if (userNameElement && user.name) userNameElement.textContent = user.name;

    profileIcon.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
      const dropdown = this.closest('.profile-dropdown').querySelector('.dropdown-menu');
      dropdown.classList.toggle('show');
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      const newBtn = logoutBtn.cloneNode(true);
      logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
      newBtn.addEventListener('click', function (e) {
        e.preventDefault();

        let modal = document.getElementById('logoutConfirmationModal');
        if (!modal) {
          modal = createLogoutConfirmationModal();
        }

        modal.style.display = 'block';
      });
    }
  } else {
    profileIcon.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" stroke-width="2"/>
        <path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    profileIcon.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
      const authModal = document.getElementById('authModal');
      if (authModal) {
        authModal.style.display = 'block';
        const loginTab = document.querySelector('[data-tab="login"]');
        if (loginTab) loginTab.click();
      }
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.profile-dropdown')) {
      const dropdowns = document.querySelectorAll('.dropdown-menu');
      dropdowns.forEach(dropdown => {
        dropdown.classList.remove('show');
      });
    }
    if (e.target.classList.contains('dropdown-item')) {
      const dropdowns = document.querySelectorAll('.dropdown-menu');
      dropdowns.forEach(dropdown => {
        dropdown.classList.remove('show');
      });
    }
  });
}

function generateReferralCode() {
  // Generate a unique code, e.g. REF-XXXXXX
  return 'REF-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function handleRegistration(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registering...';

  const name = document.getElementById('regName');
  const email = document.getElementById('regEmail');
  const password = document.getElementById('regPassword');
  const referralCodeInput = document.getElementById('referralCode');

  // Validation
  let isValid = true;

  if (!name.value.trim()) {
    showError(name, 'Enter your name');
    isValid = false;
  }

  if (!email.value.trim()) {
    showError(email, 'Enter email');
    isValid = false;
  } else if (!validateEmail(email.value.trim())) {
    showError(email, 'Invalid email format');
    isValid = false;
  } else if (findUserByEmail(email.value.trim())) {
    showError(email, 'This email is already registered');
    isValid = false;
  }

  const passwordError = validatePassword(password.value.trim());
  if (passwordError) {
    showError(password, passwordError);
    isValid = false;
  }

  // Referral code check (if entered)
  let referralCodeUsed = null;
  if (referralCodeInput && referralCodeInput.value.trim()) {
    const code = referralCodeInput.value.trim();
    const users = getUsersFromStorage();
    const owner = users.find(u => u.referralCode === code);
    if (!owner) {
      showError(referralCodeInput, 'Invalid referral code');
      isValid = false;
    } else {
      referralCodeUsed = code;
    }
  }

  if (!isValid) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign Up';
    return;
  }

  try {
    // Generate a unique referral code for the new user
    const myReferralCode = generateReferralCode();

    const newUser = {
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value.trim(),
      referralCode: myReferralCode,
      referralCodeUsed: referralCodeUsed,
      registeredAt: new Date().toISOString()
    };

    saveUserToStorage(newUser);

    // Save authentication data
    localStorage.setItem('user', JSON.stringify({
      name: newUser.name,
      email: newUser.email,
      referralCode: newUser.referralCode,
      registeredAt: newUser.registeredAt
    }));
    localStorage.setItem('isLoggedIn', 'true');

    document.getElementById('authModal').style.display = 'none';
    showToastMessage('Registration successful!');
    checkAuthState();
  } catch (error) {
    showToastMessage('Registration error', false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign Up';
  }
}

function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('loginEmail');
  const password = document.getElementById('loginPassword');
  let isValid = true;

  if (!email.value.trim()) {
    showError(email, 'Enter email');
    isValid = false;
  } else if (!validateEmail(email.value.trim())) {
    showError(email, 'Invalid email format');
    isValid = false;
  }

  if (!password.value.trim()) {
    showError(password, 'Enter password');
    isValid = false;
  }

  if (isValid) {
    const user = findUserByEmail(email.value.trim());

    if (!user) {
      showError(email, 'User not found');
      return;
    }

    if (user.password !== password.value.trim()) {
      showError(password, 'Incorrect password');
      return;
    }

    // Save all necessary data, including referralCode
    localStorage.setItem('user', JSON.stringify({
      name: user.name,
      email: user.email,
      referralCode: user.referralCode,
      registeredAt: user.registeredAt
    }));
    localStorage.setItem('isLoggedIn', 'true');
    document.getElementById('authModal').style.display = 'none';
    showToastMessage('Login successful!');
    checkAuthState();
  }
}

function handleLogout(e) {
  e.preventDefault();
  if (confirm('Are you sure you want to log out?')) {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  }
}

function initAuthSystem() {
  const authModal = document.getElementById('authModal');

  if (!authModal) {
    console.warn('Auth modal not found');
    return;
  }

  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function () {
      this.closest('.modal').style.display = 'none';
      document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.style.display = 'none';
    }
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const tabName = this.textContent.trim().toLowerCase();
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.auth-tab-content').forEach(el => el.classList.remove('active'));
      if (tabName === 'login') {
        document.getElementById('login').classList.add('active');
      } else if (tabName === 'register') {
        document.getElementById('register').classList.add('active');
      }
    });
  });

  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegistration);

  checkAuthState();
}

// ====================== INITIALIZATION ======================

window.AuthSystem = {
  init: function () {
    if (!document.getElementById('authModal')) {
      fetch('auth-modal.html')
        .then(res => res.text())
        .then(html => {
          const placeholder = document.getElementById('modals-placeholder') || document.body;
          placeholder.insertAdjacentHTML('beforeend', html);
          initAuthSystem();
        })
        .catch(console.error);
    } else {
      initAuthSystem();
    }
  },
  checkAuthState: checkAuthState,
  logout: handleLogout
};

document.addEventListener('DOMContentLoaded', function () {
  window.AuthSystem.init();
  createLogoutConfirmationModal();
});