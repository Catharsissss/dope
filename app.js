// Global variables
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let verificationData = {
  code: '',
  email: '',
  timestamp: null
};
let countdownInterval = null;
let currentProduct = null;
let selectedColor = null;
let selectedSize = null;
let quantity = 1;
let notificationInterval;
let allProducts = [];

// ====================== HELPER FUNCTIONS ======================

async function showRandomPurchaseNotification() {
  try {
    const notification = document.getElementById('purchase-notification');
    if (!notification) {
      console.error('Notification element not found');
      return;
    }

    // Check if any modal is open
    const isAnyModalOpen = document.querySelector('.modal[style*="display: block"]');
    if (isAnyModalOpen) {
      return;
    }

    // Load products if not loaded yet
    if (allProducts.length === 0) {
      const response = await fetch('/src/data/products.json');
      const data = await response.json();
      allProducts = data.products || [];
    }

    if (allProducts.length === 0) return;

    // Pick a random product
    const randomProduct = allProducts[Math.floor(Math.random() * allProducts.length)];

    // Get the first product image
    let productImage = '';
    if (randomProduct.colorOptions?.[0]?.images?.[0]) {
      productImage = randomProduct.colorOptions[0].images[0];
    } else if (randomProduct.images?.[0]) {
      productImage = randomProduct.images[0];
    }

    // Update notification content
    notification.innerHTML = `
      <div class="notification-content">
        <button class="close-notification">&times;</button>
        <div class="notification-body" data-id="${randomProduct.id}">
          <img src="/src/images/${productImage}" alt="${randomProduct.name}" 
               onerror="this.src='/src/images/placeholder.jpg'" 
               class="notification-image">
          <div class="notification-text">
            <p class="notification-message">Just purchased</p>
            <p class="product-name">${randomProduct.name}</p>
            <p class="notification-time">Click to see</p>
          </div>
        </div>
      </div>
    `;

    // Add click handler to notification
    notification.querySelector('.notification-body').addEventListener('click', function () {
      window.location.href = `/src/product.html?id=${this.dataset.id}`;
    });

    // Close notification handler
    notification.querySelector('.close-notification').addEventListener('click', (e) => {
      e.stopPropagation();
      notification.classList.remove('show');
    });

    // Show notification
    notification.classList.add('show');

    // Hide after 7 seconds
    setTimeout(() => {
      notification.classList.remove('show');
    }, 7000);

  } catch (error) {
    console.error('Notification error:', error);
  }
}

// Initialize notifications
function initPurchaseNotifications() {
  // Clear previous interval
  if (notificationInterval) {
    clearInterval(notificationInterval);
  }

  // First notification after 10 seconds
  setTimeout(() => {
    showRandomPurchaseNotification();

    // Next notifications every 10-30 seconds
    notificationInterval = setInterval(() => {
      showRandomPurchaseNotification();
    }, (Math.floor(Math.random() * 20) + 10) * 1000);
  }, 10000);
}

// Email validation
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// Password validation
function validatePassword(password) {
  if (password.length < 6) return 'Minimum 6 characters';
  if (!/[A-Z]/.test(password)) return 'Add an uppercase letter';
  if (!/\d/.test(password)) return 'Add a digit';
  return null;
}

// Show error
function showError(element, message) {
  if (!element || !element.id) return;
  const errorElement = document.getElementById(`${element.id}Error`);
  if (!errorElement) return;

  element.classList.add('error');
  errorElement.textContent = message;
  errorElement.style.display = 'block';
}

// Hide error
function hideError(element) {
  if (!element || !element.id) return;
  const errorElement = document.getElementById(`${element.id}Error`);
  if (!errorElement) return;

  element.classList.remove('error');
  errorElement.style.display = 'none';
}

// Toast notifications
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

// Email sending stub (replace with API call in real project)
function sendVerificationEmail(email, code) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 1500);
  });
}

function updateAddButtonState() {
  const addBtn = document.getElementById('add-to-cart-modal');
  if (!addBtn || !currentProduct) return;

  const requireColor = currentProduct.colorOptions?.length > 0;
  const requireSize = currentProduct.sizes?.length > 0;

  addBtn.disabled = (requireColor && !selectedColor) || (requireSize && !selectedSize);
  addBtn.textContent = addBtn.disabled ? 'Select options' : 'Add to Cart';
}

// ====================== FILTER SYSTEM ======================

function filterProducts(category) {
  const productCards = document.querySelectorAll('.product-card');
  if (!productCards.length) return;

  productCards.forEach(card => {
    card.style.display = card.dataset.category === category || category === 'all'
      ? 'block'
      : 'none';
  });
}

function initFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  if (!filterButtons.length) return;

  filterButtons.forEach(button => {
    button.addEventListener('click', function () {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      // Reset number of displayed products
      productsToShowCount = 12;
      // Save selected category
      window.currentCategory = this.dataset.category;
      renderCatalog();
    });
  });
}

// ====================== CART ======================

function updateCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCounter();
}

function updateCartCounter() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const counter = document.querySelector('.cart-count');
  if (counter) counter.textContent = count;
}

function addToCart(productId, quantity = 1, size = null, color = null) {
  const product = products.find(p => p.id == productId);
  if (!product) {
    showToastMessage('Product not found', false);
    return false;
  }

  // Check required options
  if (product.colorOptions?.length && !color) {
    showToastMessage('Please select a color', false);
    return false;
  }

  if (product.sizes?.length && !size) {
    showToastMessage('Please select a size', false);
    return false;
  }

  // Fixed block for image path
  let productImage = '';
  if (color) {
    const colorOption = product.colorOptions?.find(opt => opt.color === color);
    productImage = colorOption ? colorOption.images[0] : '';
  }

  if (!productImage && product.images?.length) {
    productImage = product.images[0];
  }

  // For catalog (no color/size selection)
  if (!size && !color) {
    const existingItem = cart.find(item => item.id == productId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: productImage || 'placeholder.jpg',
        quantity: quantity,
        size: null,
        color: null
      });
    }
  }
  // For product page (with color/size selection)
  else {
    const existingItem = cart.find(item =>
      item.id == productId &&
      item.size == size &&
      item.color == color
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: productImage || 'placeholder.jpg',
        quantity: quantity,
        size: size,
        color: color
      });
    }
  }

  updateCart();
  showToastMessage('Product added to cart');
  return true;
}

// ====================== RENDERING ======================

async function loadProducts() {
  try {
    const response = await fetch('data/products.json');
    if (!response.ok) throw new Error('Failed to load products');
    const data = await response.json();

    return {
      ...data,
      products: data.products.map(p => ({
        ...p,
        category: p.category || 'uncategorized'
      }))
    };
  } catch (error) {
    console.error('Error:', error);
    showToastMessage('Failed to load products', false);
    return { products: [] };
  }
}

let productsToShowCount = 12;
const PRODUCTS_INITIAL = 12;
const PRODUCTS_STEP = 8;

function initProductHoverEffects() {

  // Remove all existing hover handlers
  const productCards = document.querySelectorAll('.product-card');
  productCards.forEach(card => {
    // Create a new copy of the element without event handlers
    const newCard = card.cloneNode(true);
    card.replaceWith(newCard);
  });

  // Re-select all cards (now new)
  document.querySelectorAll('.product-card').forEach(card => {
    const img = card.querySelector('img');
    if (!img) return;

    const productLink = card.querySelector('a');
    if (!productLink || !productLink.href) return;

    const productId = productLink.href.match(/id=(\d+)/)?.[1];
    if (!productId) return;

    // Find product in global array
    const product = products.find(p => p.id == productId);
    if (!product) return;

    // Save original image src
    const originalSrc = img.src;

    // Get images for product
    let productImages = [];
    if (product.colorOptions && product.colorOptions.length > 0 && product.colorOptions[0].images) {
      productImages = product.colorOptions[0].images;
    } else if (product.images && product.images.length) {
      productImages = product.images;
    }

    if (productImages.length > 1) {
      // If there is a second image - use it on hover
      const handleMouseEnter = function () {
        img.src = '/src/images/' + productImages[1];
      };

      const handleMouseLeave = function () {
        img.src = originalSrc;
      };

      card.addEventListener('mouseenter', handleMouseEnter);
      card.addEventListener('mouseleave', handleMouseLeave);
    } else {
      // If no second image - use scale effect
      const handleMouseEnter = function () {
        img.style.transform = 'scale(1.07)';
        img.style.transition = 'transform 0.3s';
      };

      const handleMouseLeave = function () {
        img.style.transform = '';
      };

      card.addEventListener('mouseenter', handleMouseEnter);
      card.addEventListener('mouseleave', handleMouseLeave);
    }
  });

}

async function renderCatalog() {
  const grid = document.querySelector('.products-grid');
  const showMoreBtn = document.getElementById('show-more-btn');
  if (!grid) return;

  try {
    const { products: loadedProducts } = await loadProducts();
    products = loadedProducts;

    // Get selected category
    const category = window.currentCategory || 'all';

    // Filter products by category
    let filteredProducts = products;
    if (category !== 'all') {
      filteredProducts = products.filter(p => p.category === category);
    }

    if (!filteredProducts.length) {
      grid.innerHTML = '<p class="empty-message">No products found</p>';
      if (showMoreBtn) showMoreBtn.style.display = 'none';
      return;
    }

    // Show only productsToShowCount products
    const visibleProducts = filteredProducts.slice(0, productsToShowCount);

    grid.innerHTML = visibleProducts.map(product => {
      const firstColor = product.colorOptions?.[0];
      const mainImage = firstColor
        ? firstColor.images[0]
        : 'placeholder.jpg';

      return `
        <div class="product-card" data-category="${product.category}">
          <a href="/src/product.html?id=${product.id}">
            <img src="/src/images/${mainImage}" 
                 alt="${product.name}" 
                 onerror="this.src='/src/images/placeholder.jpg'">
            <h3>${product.name}</h3>
            <p class="price">${product.price.toFixed(2)} $</p>
          </a>
          <button class="add-to-cart" data-id="${product.id}">Add to cart</button>
        </div>
      `;
    }).join('');

    initProductHoverEffects();
    initAddToCartButtons();

    // Show or hide "Show more" button
    if (showMoreBtn) {
      if (productsToShowCount < filteredProducts.length) {
        showMoreBtn.style.display = 'block';
      } else {
        showMoreBtn.style.display = 'none';
      }
    }

    // Handlers for "Add to cart" buttons
    document.querySelectorAll('.add-to-cart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        addToCart(btn.dataset.id);
      });
    });

    // Initialize filters only on catalog page
    const isHomePage = document.querySelector('.hero') !== null;
    if (!isHomePage) {
      initFilters();
    }

  } catch (error) {
    console.error('Render error:', error);
    grid.innerHTML = '<p class="error">Failed to load products</p>';
    if (showMoreBtn) showMoreBtn.style.display = 'none';
  }
}


async function renderProduct() {
  const productPage = document.querySelector('.product-page');
  if (!productPage) return;

  try {
    const productId = new URLSearchParams(window.location.search).get('id');
    const { products: loadedProducts } = await loadProducts();
    products = loadedProducts;
    const product = products.find(p => p.id == productId);

    if (!product) {
      productPage.innerHTML = `
        <div class="container">
          <h1>Product not found</h1>
          <a href="catalog.html">Back to catalog</a>
        </div>
      `;
      return;
    }

    // Fill in data
    document.title = `${product.name} | Dope Lab`;
    productPage.querySelector('h1').textContent = product.name;
    productPage.querySelector('.price').textContent = `${product.price.toFixed(2)} ₽`;
    productPage.querySelector('.description').textContent = product.description || '';

    // Image gallery
    const thumbnails = productPage.querySelector('.thumbnails');
    const mainImage = productPage.querySelector('.main-image');

    if (product.images?.length) {
      thumbnails.innerHTML = product.images.map((img, index) => `
        <img src="images/${img}" alt="${product.name} ${index + 1}" 
             onclick="this.closest('.product-gallery').querySelector('.main-image').src='images/${img}'">
      `).join('');
      mainImage.src = `images/${product.images[0]}`;
    }

    // Sizes
    const sizesContainer = productPage.querySelector('.sizes');
    if (sizesContainer) {
      sizesContainer.innerHTML = product.sizes?.length
        ? product.sizes.map(size => `
        <div class="size" data-size="${size}">
          ${size}
        </div>
      `).join('')
        : '<div>No sizes available</div>';

      sizesContainer.querySelectorAll('.size').forEach(el => {
        el.addEventListener('click', function () {
          if (this.classList.contains('selected')) {
            this.classList.remove('selected');
          } else {
            sizesContainer.querySelectorAll('.size').forEach(s => s.classList.remove('selected'));
            this.classList.add('selected');
          }
        });
      });
    }

    // "Add to cart" button
    productPage.querySelector('.add-to-cart-btn')?.addEventListener('click', () => {
      const product = products.find(p => p.id == productId);
      if (!product) return;

      if (product.sizes?.length) {
        const selectedSize = productPage.querySelector('.size.selected');
        if (!selectedSize) {
          showToastMessage('Please select a size', false);
          return;
        }
        const added = addToCart(product.id, 1, selectedSize.dataset.size);
        if (added) {
          showToastMessage('Product added to cart');
        }
      } else {
        const added = addToCart(product.id);
        if (added) {
          showToastMessage('Product added to cart');
        }
      }
    });

  } catch (error) {
    productPage.innerHTML = `
      <div class="container">
        <h1>Error loading product</h1>
        <a href="catalog.html">Back to catalog</a>
      </div>
    `;
  }
  initAddToCartButtons();
}

function initAddToCartButtons() {
  document.body.addEventListener('click', function (e) {
    if (e.target.closest('.add-to-cart')) {
      e.preventDefault();
      const btn = e.target.closest('.add-to-cart');
      const productId = btn.dataset.id;
      const product = products.find(p => p.id == productId);

      if (!product) return;

      if (product.colorOptions || product.sizes) {
        openProductModal(productId);
      } else {
        addToCart(productId);
        showToastMessage('Product added to cart');
      }
    }
  });
}

function openProductModal(productId) {
  const authModal = document.getElementById('authModal');
  if (authModal) authModal.style.display = 'none';
  const product = products.find(p => p.id == productId);
  if (!product) return;

  currentProduct = product;
  selectedColor = null;
  selectedSize = null;
  quantity = 1;

  document.getElementById('modal-product-name').textContent = product.name;

  let defaultImage = 'placeholder.jpg';
  if (product.colorOptions?.[0]?.images?.[0]) {
    defaultImage = product.colorOptions[0].images[0];
  } else if (product.images?.[0]) {
    defaultImage = product.images[0];
  }
  document.getElementById('modal-product-image').src = `/src/images/${defaultImage}`;

  let allImages = [];
  if (product.colorOptions?.length) {
    product.colorOptions.forEach(opt => {
      if (Array.isArray(opt.images)) allImages.push(...opt.images);
    });
  }
  if (product.images?.length) {
    allImages.push(...product.images);
  }
  allImages = [...new Set(allImages)];

  const thumbnailsContainer = document.getElementById('modal-thumbnails');
  if (thumbnailsContainer) {
    thumbnailsContainer.innerHTML = allImages.map((img, idx) => `
    <img src="/src/images/${img}" 
         alt="thumb" 
         class="${idx === 0 ? 'active' : ''}" 
         data-img="${img}">
  `).join('');

    thumbnailsContainer.querySelectorAll('img').forEach(thumb => {
      thumb.addEventListener('click', function () {
        document.getElementById('modal-product-image').src = `/src/images/${this.dataset.img}`;
        thumbnailsContainer.querySelectorAll('img').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
      });
    });
  }

  const colorContainer = document.getElementById('color-options');
  colorContainer.innerHTML = '';

  if (product.colorOptions?.length) {
    product.colorOptions.forEach((colorOption) => {
      const colorEl = document.createElement('div');
      colorEl.className = 'color-option';
      colorEl.textContent = colorOption.color;
      colorEl.dataset.color = colorOption.color;

      colorEl.addEventListener('click', () => {
        if (selectedColor === colorOption.color) {
          colorEl.classList.remove('selected');
          selectedColor = null;
        } else {
          document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
          colorEl.classList.add('selected');
          selectedColor = colorOption.color;
          document.getElementById('modal-product-image').src = `/src/images/${colorOption.images[0]}`;
        }
        updateAddButtonState();
      });

      colorContainer.appendChild(colorEl);
    });
  }

  const sizeContainer = document.getElementById('size-options');
  sizeContainer.innerHTML = '';

  if (product.sizes?.length) {
    product.sizes.forEach((size) => {
      const sizeEl = document.createElement('div');
      sizeEl.className = 'size-option';
      sizeEl.textContent = size;
      sizeEl.dataset.size = size;

      sizeEl.addEventListener('click', () => {
        if (selectedSize === size) {
          sizeEl.classList.remove('selected');
          selectedSize = null;
        } else {
          document.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('selected'));
          sizeEl.classList.add('selected');
          selectedSize = size;
        }
        updateAddButtonState();
      });

      sizeContainer.appendChild(sizeEl);
    });
  }

  document.querySelector('.quantity-value').textContent = quantity;

  const addBtn = document.getElementById('add-to-cart-modal');
  addBtn.disabled = true;
  addBtn.textContent = 'Select options';

  document.getElementById('product-modal').style.display = 'block';
}

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

  if (!profileIcon) {
    console.error('Profile icon element not found');
    return;
  }

  if (isLoggedIn) {
    const user = JSON.parse(localStorage.getItem('user')) || {};

    profileIcon.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="currentColor"/>
        <path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;

    const userNameElement = document.querySelector('.user-name');
    if (userNameElement && user.name) {
      userNameElement.textContent = user.name;
    }

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

function generateReferralCode() {
  return 'REF-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function handleRegistration(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registration...';

  const name = document.getElementById('regName');
  const email = document.getElementById('regEmail');
  const password = document.getElementById('regPassword');
  const referralCodeInput = document.getElementById('referralCode');

  let isValid = true;

  if (!name.value.trim()) {
    showError(name, 'Enter name');
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
    submitBtn.textContent = 'Register';
    return;
  }

  try {
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

    localStorage.setItem('user', JSON.stringify({
      name: newUser.name,
      email: newUser.email,
      referralCode: newUser.referralCode,
      registeredAt: newUser.registeredAt
    }));
    localStorage.setItem('isLoggedIn', 'true');

    document.getElementById('authModal').style.display = 'none';
    showToastMessage('Registration completed successfully!');
    checkAuthState();
  } catch (error) {
    showToastMessage('Error during registration', false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Register';
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
      showError(password, 'Invalid password');
      return;
    }

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

function initAuthSystem() {
  const authModal = document.getElementById('authModal');

  if (!authModal) {
    console.warn('Authorization modal not found');
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

      document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active');
      });
      this.classList.add('active');

      document.querySelectorAll('.auth-tab-content').forEach(el => {
        el.classList.remove('active');
      });

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


async function initFeaturedSlider() {
  const sliderContainer = document.querySelector('.slider-container');
  const indicators = document.querySelector('.slider-indicators');
  const prevBtn = document.querySelector('.prev-slide');
  const nextBtn = document.querySelector('.next-slide');

  if (!sliderContainer || !prevBtn || !nextBtn) return;

  try {
    const { products: loadedProducts } = await loadProducts();
    products = loadedProducts; // Update global products variable

    // Shuffle the products array to get random products
    const shuffledProducts = [...loadedProducts].sort(() => 0.5 - Math.random());

    // Get 12 products for the slider (or with featured tag if available)
    const featuredProducts = shuffledProducts
      .filter(p => p.featured || true)
      .slice(0, 12);

    if (!featuredProducts.length) {
      sliderContainer.innerHTML = '<p class="empty-message">Популярные товары не найдены</p>';
      return;
    }

    // Group products into slides of 4 products each
    const slidesCount = Math.ceil(featuredProducts.length / 4);
    let slidesHTML = '';

    for (let i = 0; i < slidesCount; i++) {
      const slideProducts = featuredProducts.slice(i * 4, (i + 1) * 4);

      slidesHTML += `
        <div class="slide ${i === 0 ? 'active' : ''}" data-index="${i}">
          <div class="slide-grid">
            ${slideProducts.map(product => {
        // Get first available image
        const firstColor = product.colorOptions?.[0];
        const mainImage = firstColor
          ? firstColor.images[0]
          : product.images?.[0] || 'placeholder.jpg';

        return `
                <div class="product-card">
                  <a href="/src/product.html?id=${product.id}">
                    <img src="/src/images/${mainImage}" 
                         alt="${product.name}" 
                         onerror="this.src='/src/images/placeholder.jpg'">
                    <h3>${product.name}</h3>
                    <p class="price">${product.price.toFixed(2)} $</p>
                  </a>
                  <button class="add-to-cart" data-id="${product.id}">Add to cart</button>
                </div>
              `;
      }).join('')}
          </div>
        </div>
      `;
    }

    sliderContainer.innerHTML = slidesHTML;

    initProductHoverEffects();

    // Create indicators (one per slide, not per product)
    if (indicators) {
      indicators.innerHTML = Array(slidesCount).fill(0).map((_, index) =>
        `<span class="indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></span>`
      ).join('');

      // Add handlers for indicators
      indicators.querySelectorAll('.indicator').forEach(indicator => {
        indicator.addEventListener('click', () => {
          const index = parseInt(indicator.dataset.index);
          showSlide(index);
        });
      });
    }

    // Button handlers
    let currentSlide = 0;
    const totalSlides = slidesCount; // Now using number of slides, not products

    prevBtn.addEventListener('click', () => {
      currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
      showSlide(currentSlide);
    });

    nextBtn.addEventListener('click', () => {
      currentSlide = (currentSlide + 1) % totalSlides;
      showSlide(currentSlide);
    });

    // Function to show slide
    function showSlide(index) {
      sliderContainer.querySelectorAll('.slide').forEach(slide => {
        slide.classList.remove('active');
      });

      const targetSlide = sliderContainer.querySelector(`.slide[data-index="${index}"]`);
      if (targetSlide) {
        targetSlide.classList.add('active');
        currentSlide = index;

        // Update indicators
        if (indicators) {
          indicators.querySelectorAll('.indicator').forEach(ind => {
            ind.classList.remove('active');
          });
          indicators.querySelector(`.indicator[data-index="${index}"]`).classList.add('active');
        }
      }
    }

    // Auto-slide
    let slideInterval = setInterval(() => {
      currentSlide = (currentSlide + 1) % totalSlides;
      showSlide(currentSlide);
    }, 5000);

    // Stop auto-slide on hover
    sliderContainer.addEventListener('mouseenter', () => {
      clearInterval(slideInterval);
    });

    // Resume auto-slide when mouse leaves
    sliderContainer.addEventListener('mouseleave', () => {
      slideInterval = setInterval(() => {
        currentSlide = (currentSlide + 1) % totalSlides;
        showSlide(currentSlide);
      }, 5000);
    });

    // Initialize "Add to cart" buttons
    initAddToCartButtons();

  } catch (error) {
    console.error('Ошибка в слайдере:', error);
    sliderContainer.innerHTML = '<p class="error">Не удалось загрузить популярные товары</p>';
  }
}


document.addEventListener('DOMContentLoaded', () => {
  initPurchaseNotifications();
  updateCartCounter();
  createLogoutConfirmationModal();

  const isProductPage = document.querySelector('.product-page');
  const isCatalogPage = document.querySelector('.catalog') ||
    (document.querySelector('.products-grid') && !document.querySelector('.hero'));
  const isHomePage = document.querySelector('.hero');

  if (isHomePage && document.querySelector('.featured-slider')) {
    initFeaturedSlider();
  }

  if (document.querySelector('.products-grid')) {
    setTimeout(() => {
      initProductHoverEffects();
    }, 200);
  }

  const showMoreBtn = document.getElementById('show-more-btn');
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      productsToShowCount += PRODUCTS_STEP;
      renderCatalog();
    });
  }

  if (!document.getElementById('authModal') && (isProductPage || isCatalogPage || isHomePage)) {
    fetch('auth-modal.html')
      .then(res => res.text())
      .then(html => {
        const placeholder = document.getElementById('modals-placeholder') || document.body;
        placeholder.insertAdjacentHTML('beforeend', html);
        initAuthSystem();
      })
      .catch(console.error);
  } else if (document.getElementById('authModal')) {
    initAuthSystem();
  }

  if (isProductPage) {
    renderProduct();
  } else if (isCatalogPage || isHomePage) {
    renderCatalog();
  }

  checkAuthState();
  document.querySelector('.quantity-btn.minus')?.addEventListener('click', () => {
    if (quantity > 1) {
      quantity--;
      document.querySelector('.quantity-value').textContent = quantity;
    }
  });

  document.querySelector('.quantity-btn.plus')?.addEventListener('click', () => {
    quantity++;
    document.querySelector('.quantity-value').textContent = quantity;
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-option') || e.target.classList.contains('size-option')) {
      const addBtn = document.getElementById('add-to-cart-modal');
      if (!addBtn) return;

      const colorSelected = document.querySelector('.color-option.selected');
      const sizeSelected = document.querySelector('.size-option.selected');

      const requireColor = currentProduct?.colorOptions?.length > 0;
      const requireSize = currentProduct?.sizes?.length > 0;

      addBtn.disabled = (requireColor && !colorSelected) || (requireSize && !sizeSelected);

      if (!addBtn.disabled) {
        addBtn.textContent = 'Add to cart';
      }
      updateAddButtonState();
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', function (e) {
    e.preventDefault();
    if (confirm('Are you sure you want to log out?')) {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user');
      window.location.href = 'index.html';
    }
  });

  document.getElementById('add-to-cart-modal')?.addEventListener('click', () => {
    if (!currentProduct) return;

    const added = addToCart(
      currentProduct.id,
      quantity,
      currentProduct.sizes?.length ? selectedSize : null,
      currentProduct.colorOptions?.length ? selectedColor : null
    );

    if (added) {
      document.getElementById('product-modal').style.display = 'none';
      showToastMessage('Product added to cart');
    }
  });

  document.querySelector('.close-modal')?.addEventListener('click', () => {
    document.getElementById('product-modal').style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('product-modal')) {
      document.getElementById('product-modal').style.display = 'none';
    }
  });
});