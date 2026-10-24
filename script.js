const sampleProducts = [
  {
    name: 'Classic Chocolate Chip',
    tag: 'Signature Cookie',
    description: 'A classic cookie loaded with chocolate chips.',
    price: 99,
    image: 'assets/cookies/Cookie1.png',
    fallbackImage: 'assets/cookies/Cookie1.png',
    bgStart: '#e8c868',
    bgEnd: '#d1a954',
    accent: '#f8e9b9',
    badge: 'Baked Daily',
    displayWord: 'COOKIE'
  },
  {
    name: 'Double Chocolate',
    tag: 'Rich & Decadent',
    description: 'A rich chocolate cookie made for chocolate lovers.',
    price: 119,
    image: 'assets/cookies/Cookie1.png',
    fallbackImage: 'assets/cookies/Cookie1.png',
    bgStart: '#c8aa8d',
    bgEnd: '#a88464',
    accent: '#d7b08b',
    badge: 'Cocoa Blend',
    displayWord: 'CHOCO'
  },
  {
    name: 'Red Velvet',
    tag: 'Velvety Treat',
    description: 'A soft red velvet cookie with a delicious creamy finish.',
    price: 129,
    image: 'assets/cookies/Cookie1.png',
    fallbackImage: 'assets/cookies/Cookie1.png',
    bgStart: '#d59a8f',
    bgEnd: '#c5827d',
    accent: '#f4d9d1',
    badge: 'Velvet Swirl',
    displayWord: 'VELVET'
  },
  {
    name: 'Matcha White Chocolate',
    tag: 'Green & Creamy',
    description: 'A flavorful matcha cookie with white chocolate pieces.',
    price: 129,
    image: 'assets/cookies/Cookie1.png',
    fallbackImage: 'assets/cookies/Cookie1.png',
    bgStart: '#bfd7b1',
    bgEnd: '#8da86d',
    accent: '#edf5d0',
    badge: 'Seasonal Pick',
    displayWord: 'MATCHA'
  }
];

let products = [...sampleProducts];
let catalogCookies = [...sampleProducts];

const root = document.documentElement;
const hero = document.querySelector('.hero');
const productName = document.getElementById('productName');
const productTag = document.getElementById('productTag');
const productDescription = document.getElementById('productDescription');
const productPrice = document.getElementById('productPrice');
const productCurrency = document.querySelector('.currency');
const productImage = document.getElementById('productImage');
const floatingBadge = document.getElementById('floatingBadge');
const displayWord = document.getElementById('displayWord');
const pagination = document.getElementById('carouselPagination');
const cookieGrid = document.getElementById('cookieGrid');
const cookieGridScrollbar = document.getElementById('cookieGridScrollbar');
const cookieGridScrollbarThumb = document.getElementById('cookieGridScrollbarThumb');
const productDialog = document.getElementById('productDialog');
const cartDialog = document.getElementById('cartDialog');
const quantityInput = document.getElementById('quantityInput');
const cart = new Map();
let selectedProduct = null;

let activeIndex = 0;
let isAnimating = false;
let autoRotateTimer = null;
let autoRotateDeadline = 0;
let autoRotateRemaining = 6000;
const pointerPauseTargets = new Set();
const focusPauseTargets = new Set();
let lastInputWasPointer = false;
let startX = 0;
let startY = 0;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DESKTOP_WHEEL_STEP_PX = 170;

const currencySymbols = {
  PHP: '\u20B1',
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3'
};

function readXmlText(parent, selector, fallback = '') {
  return parent.querySelector(selector)?.textContent.trim() || fallback;
}

function safeHexColor(value, fallback) {
  return /^#[\da-f]{6}$/i.test(value || '') ? value : fallback;
}

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first, second) {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function applySupportingSectionPalette(backgroundStart, backgroundEnd) {
  const backgroundLuminances = [backgroundStart, backgroundEnd].map(relativeLuminance);
  const palettes = [
    {
      ink: '#291a12',
      muted: 'rgba(41, 26, 18, 0.9)',
      accent: '#291a12',
      rule: 'rgba(41, 26, 18, 0.34)'
    },
    {
      ink: '#fff5e8',
      muted: 'rgba(255, 245, 232, 0.9)',
      accent: '#ffe0a8',
      rule: 'rgba(255, 245, 232, 0.4)'
    }
  ];
  const palette = palettes.reduce((best, candidate) => {
    const minimumContrast = Math.min(
      ...backgroundLuminances.map((background) => contrastRatio(relativeLuminance(candidate.ink), background))
    );
    return !best || minimumContrast > best.minimumContrast
      ? { ...candidate, minimumContrast }
      : best;
  }, null);

  root.style.setProperty('--support-ink', palette.ink);
  root.style.setProperty('--support-muted', palette.muted);
  root.style.setProperty('--support-accent', palette.accent);
  root.style.setProperty('--support-rule', palette.rule);
}

function parseCookiesXml(xmlText) {
  const documentXml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (documentXml.querySelector('parsererror')) {
    throw new Error('Cookies.xml contains invalid XML.');
  }

  const cookieNodes = [...documentXml.querySelectorAll('Cookies > Cookie')];
  if (!cookieNodes.length) {
    throw new Error('Cookies.xml does not contain any Cookie entries.');
  }

  return cookieNodes.map((node, index) => {
    const priceNode = node.querySelector('Price');
    const background = node.querySelector('Background');
    const name = readXmlText(node, 'Name');
    const priceText = priceNode?.textContent.trim() || '';
    const priceUnavailable = /^n\/a$/i.test(priceText);
    const price = priceUnavailable ? null : Number(priceText);
    const ingredientNodes = [...node.querySelectorAll('Ingredients > Ingredient')];
    const ingredientsNode = node.querySelector('Ingredients');
    const ingredients = ingredientNodes.length
      ? ingredientNodes.map((ingredient) => ingredient.textContent.trim()).filter(Boolean)
      : (ingredientsNode?.textContent || '')
          .split(/[,;\n]+/)
          .map((ingredient) => ingredient.trim())
          .filter(Boolean);

    if (!name || (!priceUnavailable && !Number.isFinite(price))) {
      throw new Error(`Cookie entry ${index + 1} needs a Name and a numeric Price or N/A.`);
    }

    return {
      id: node.getAttribute('id') || `cookie-${index + 1}`,
      name,
      tag: readXmlText(node, 'Tag', 'Freshly baked'),
      description: readXmlText(node, 'Description'),
      ingredients,
      heroCookie: readXmlText(node, 'HeroCookie', 'false').toLowerCase() === 'true',
      price,
      currency: (priceNode?.getAttribute('currency') || 'PHP').toUpperCase(),
      image: readXmlText(node, 'Image', 'assets/cookies/Cookie1.png'),
      fallbackImage: readXmlText(node, 'FallbackImage', 'assets/cookies/Cookie1.png'),
      bgStart: safeHexColor(background?.getAttribute('start'), '#e8c868'),
      bgEnd: safeHexColor(background?.getAttribute('end'), '#d1a954'),
      accent: safeHexColor(readXmlText(node, 'Accent'), '#f8e9b9'),
      badge: readXmlText(node, 'Badge', 'Baked Daily'),
      displayWord: readXmlText(node, 'DisplayWord', 'COOKIE')
    };
  });
}

async function loadCookiesFromXml() {
  const response = await fetch('./Cookies.xml', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Cookies.xml request failed (${response.status}).`);
  }

  return parseCookiesXml(await response.text());
}

function currencySymbol(product) {
  return currencySymbols[product.currency] || product.currency || '\u20B1';
}

function formatPrice(product, amount = product.price) {
  if (!Number.isFinite(Number(amount)) || amount === null || amount === '') {
    return 'Price on request';
  }
  return `${currencySymbol(product)}${Number(amount).toLocaleString('en-PH')}`;
}

function renderCookieCatalog() {
  const grid = cookieGrid;
  if (!grid) return;

  grid.replaceChildren();

  catalogCookies.forEach((product) => {
    const card = document.createElement('a');
    card.href = '#productDialog';
    card.className = 'cookie-card';
    card.setAttribute('aria-label', `View details for ${product.name}`);
    card.addEventListener('click', (event) => {
      event.preventDefault();
      openProductModal(product);
    });

    const imageFrame = document.createElement('div');
    imageFrame.className = 'cookie-card-image';
    imageFrame.style.background = `linear-gradient(145deg, ${product.bgStart}, ${product.bgEnd})`;

    const image = document.createElement('img');
    image.src = product.image;
    image.alt = `${product.name} cookie`;
    image.loading = 'lazy';
    image.onerror = () => {
      image.src = product.fallbackImage;
      image.onerror = null;
    };
    imageFrame.append(image);

    const content = document.createElement('div');
    content.className = 'cookie-card-content';

    const tag = document.createElement('p');
    tag.className = 'cookie-card-tag';
    tag.textContent = product.tag;

    const name = document.createElement('h3');
    name.textContent = product.name;

    const description = document.createElement('p');
    description.className = 'cookie-card-description';
    description.textContent = product.description;

    const footer = document.createElement('div');
    footer.className = 'cookie-card-footer';

    const price = document.createElement('span');
    price.className = 'cookie-card-price';
    const viewLink = document.createElement('span');
    viewLink.className = 'cookie-card-link';
    viewLink.textContent = `View details  ${'\u2192'}`;

    price.textContent = formatPrice(product);
    footer.append(price, viewLink);
    content.append(tag, name, description, footer);
    card.append(imageFrame, content);
    grid.append(card);
  });

  requestAnimationFrame(updateCookieGridScrollbar);
}

function updateCookieGridScrollbar() {
  if (!cookieGrid || !cookieGridScrollbar || !cookieGridScrollbarThumb) return;

  const { clientHeight, scrollHeight, scrollTop } = cookieGrid;
  const trackHeight = cookieGridScrollbar.clientHeight;
  const canScroll = scrollHeight > clientHeight + 1 && trackHeight > 0;
  cookieGridScrollbar.hidden = !canScroll;
  if (!canScroll) return;

  const thumbHeight = Math.max(28, (clientHeight / scrollHeight) * trackHeight);
  const travel = Math.max(0, trackHeight - thumbHeight);
  const progress = scrollTop / (scrollHeight - clientHeight);
  cookieGridScrollbarThumb.style.height = `${thumbHeight}px`;
  cookieGridScrollbarThumb.style.transform = `translate3d(0, ${travel * progress}px, 0)`;
}

function bindCookieGridScrollbar() {
  if (!cookieGrid || !cookieGridScrollbar) return;
  cookieGrid.addEventListener('scroll', updateCookieGridScrollbar, { passive: true });
  window.addEventListener('resize', updateCookieGridScrollbar);
  updateCookieGridScrollbar();
}

function openProductModal(product) {
  if (!product || !productDialog) return;
  selectedProduct = product;

  document.getElementById('modalCookieTag').textContent = product.tag;
  document.getElementById('modalCookieName').textContent = product.name;
  document.getElementById('modalCookieDescription').textContent = product.description;
  document.getElementById('modalUnitPrice').textContent = formatPrice(product);
  const priceUnavailable = !Number.isFinite(product.price);
  const buyButton = document.getElementById('buyButton');
  buyButton.disabled = priceUnavailable;
  quantityInput.disabled = priceUnavailable;
  document.getElementById('quantityDecrease').disabled = priceUnavailable;
  document.getElementById('quantityIncrease').disabled = priceUnavailable;
  document.getElementById('orderMessageStatus').textContent = priceUnavailable
    ? 'Choose a platform to ask about availability and confirm the price.'
    : 'Choose a platform to copy your order message and open its chat. In Messenger, click Continue, then paste and send.';

  const modalImage = document.getElementById('modalCookieImage');
  modalImage.alt = `${product.name} cookie`;
  modalImage.onerror = () => {
    modalImage.src = product.fallbackImage;
    modalImage.onerror = null;
  };
  modalImage.src = product.image;
  document.getElementById('modalImageFrame').style.background =
    `linear-gradient(145deg, ${product.bgStart}, ${product.bgEnd})`;

  const ingredientList = document.getElementById('ingredientList');
  const ingredientEmpty = document.getElementById('ingredientEmpty');
  ingredientList.replaceChildren();
  (product.ingredients || []).forEach((ingredient) => {
    const item = document.createElement('li');
    item.textContent = ingredient;
    ingredientList.append(item);
  });
  ingredientList.hidden = !product.ingredients?.length;
  ingredientEmpty.hidden = Boolean(product.ingredients?.length);

  quantityInput.value = '1';
  updateModalTotal();
  productDialog.showModal();
}

function currentQuantity() {
  const entered = Number.parseInt(quantityInput.value, 10);
  return Math.min(99, Math.max(1, Number.isFinite(entered) ? entered : 1));
}

function updateModalTotal() {
  const product = selectedProduct;
  if (!product) return;

  const quantity = currentQuantity();
  document.getElementById('modalTotal').textContent = Number.isFinite(product.price)
    ? formatPrice(product, product.price * quantity)
    : 'Price on request';

}

function updateCartCount() {
  const count = [...cart.values()].reduce((sum, entry) => sum + entry.quantity, 0);
  const cartCount = document.getElementById('cartCount');
  const cartButton = document.querySelector('.cart-button');
  cartCount.textContent = String(count);
  cartCount.hidden = count === 0;
  cartButton.setAttribute('aria-label', count ? `View cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'View cart');
}

function renderCart() {
  const cartItems = document.getElementById('cartItems');
  const cartEmpty = document.getElementById('cartEmpty');
  const cartSummaryRow = document.getElementById('cartSummaryRow');
  const cartFacebookOrderButton = document.getElementById('cartFacebookOrderButton');
  const cartInstagramOrderButton = document.getElementById('cartInstagramOrderButton');
  const entries = [...cart.entries()];
  cartItems.replaceChildren();
  cartEmpty.hidden = entries.length > 0;
  cartSummaryRow.hidden = entries.length === 0;
  cartFacebookOrderButton.hidden = entries.length === 0;
  cartInstagramOrderButton.hidden = entries.length === 0;
  document.getElementById('cartOrderStatus').textContent = entries.length
    ? 'Choose a platform to copy your item list and open the chat. In Messenger, click Continue, then paste and send.'
    : 'Add cookies to your order, then choose where to send it.';

  let subtotal = 0;
  entries.forEach(([id, entry]) => {
    const row = document.createElement('div');
    row.className = 'cart-item';

    const info = document.createElement('div');
    info.className = 'cart-item-info';
    const name = document.createElement('strong');
    name.textContent = entry.product.name;
    const meta = document.createElement('span');
    meta.textContent = `${entry.quantity} × ${formatPrice(entry.product)}`;
    info.append(name, meta);

    const side = document.createElement('div');
    side.className = 'cart-item-side';
    const lineTotal = document.createElement('strong');
    lineTotal.textContent = formatPrice(entry.product, entry.quantity * entry.product.price);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'cart-remove';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${entry.product.name} from your order`);
    remove.addEventListener('click', () => {
      cart.delete(id);
      renderCart();
      updateCartCount();
    });
    side.append(lineTotal, remove);
    row.append(info, side);
    cartItems.append(row);
    subtotal += entry.quantity * entry.product.price;
  });

  const subtotalCurrency = entries[0]?.[1].product || { currency: 'PHP' };
  document.getElementById('cartSubtotal').textContent = formatPrice(subtotalCurrency, subtotal);
  updateCartCount();
}

function addSelectedCookieToCart() {
  const product = selectedProduct;
  if (!product || !Number.isFinite(product.price)) return;

  const id = product.id || product.name;
  const previous = cart.get(id);
  cart.set(id, {
    product,
    quantity: (previous?.quantity || 0) + currentQuantity()
  });
  productDialog.close();
  renderCart();
  cartDialog.showModal();
}

function buildOrderMessage() {
  return `Hello, is ${selectedProduct.name} still available? I would like to order ${currentQuantity()} of this.`;
}

function buildCartOrderMessage() {
  const lines = [...cart.values()].map(({ product, quantity }) => `- ${product.name} × ${quantity}`);
  return `Hello, are these cookies still available? I would like to order:\n${lines.join('\n')}`;
}

function copyTextFallback(text) {
  const temporaryInput = document.createElement('textarea');
  temporaryInput.value = text;
  temporaryInput.setAttribute('readonly', '');
  temporaryInput.setAttribute('aria-hidden', 'true');
  Object.assign(temporaryInput.style, {
    position: 'fixed',
    inset: '0 auto auto -9999px',
    opacity: '0',
    pointerEvents: 'none'
  });
  document.body.append(temporaryInput);
  temporaryInput.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  temporaryInput.remove();
  return copied;
}

async function openOrderChat(platform, orderMessage = buildOrderMessage(), status = document.getElementById('orderMessageStatus')) {
  const chatUrls = {
    facebook: 'https://m.me/61575481432713',
    instagram: 'https://ig.me/m/selah.dvo'
  };
  const url = chatUrls[platform];
  if (!url) return;

  const fallbackCopied = copyTextFallback(orderMessage);

  let clipboardWrite;
  try {
    clipboardWrite = navigator.clipboard?.writeText(orderMessage);
  } catch {
    clipboardWrite = null;
  }
  window.open(url, '_blank', 'noopener,noreferrer');

  const copiedStatus = platform === 'facebook'
    ? 'Your message is copied. In Messenger, click Continue, paste it into the chat, and tap Send.'
    : 'Your message is copied. Paste it into the Instagram chat and tap Send.';
  try {
    if (clipboardWrite) {
      await clipboardWrite;
    } else if (!fallbackCopied) {
      throw new Error('Clipboard access unavailable.');
    }
    status.textContent = copiedStatus;
  } catch {
    status.textContent = fallbackCopied
      ? copiedStatus
      : 'The chat is open, but your browser blocked automatic copying. Allow clipboard access and choose the platform again.';
  }
}

function bindShoppingControls() {
  document.querySelector('.cart-button').addEventListener('click', () => {
    renderCart();
    cartDialog.showModal();
  });

  document.getElementById('quantityDecrease').addEventListener('click', () => {
    quantityInput.value = String(Math.max(1, currentQuantity() - 1));
    updateModalTotal();
  });

  document.getElementById('quantityIncrease').addEventListener('click', () => {
    quantityInput.value = String(Math.min(99, currentQuantity() + 1));
    updateModalTotal();
  });

  quantityInput.addEventListener('input', updateModalTotal);
  quantityInput.addEventListener('change', () => {
    quantityInput.value = String(currentQuantity());
    updateModalTotal();
  });
  document.getElementById('buyButton').addEventListener('click', addSelectedCookieToCart);
  document.getElementById('facebookOrderButton').addEventListener('click', () => openOrderChat('facebook'));
  document.getElementById('instagramOrderButton').addEventListener('click', () => openOrderChat('instagram'));
  document.getElementById('cartFacebookOrderButton').addEventListener('click', () => (
    openOrderChat('facebook', buildCartOrderMessage(), document.getElementById('cartOrderStatus'))
  ));
  document.getElementById('cartInstagramOrderButton').addEventListener('click', () => (
    openOrderChat('instagram', buildCartOrderMessage(), document.getElementById('cartOrderStatus'))
  ));

  document.querySelector('.purchase-row .cta').addEventListener('click', (event) => {
    event.preventDefault();
    openProductModal(products[activeIndex]);
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById(button.dataset.closeDialog)?.close();
    });
  });

  [productDialog, cartDialog].forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

function bindStickyMobileNav() {
  const stickyNav = document.querySelector('.mobile-sticky-nav');
  const sentinel = document.querySelector('.mobile-nav-sentinel');
  if (!stickyNav || !sentinel || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(([entry]) => {
    const isMobile = window.matchMedia('(max-width: 700px)').matches;
    stickyNav.classList.toggle('is-stuck', isMobile && !entry.isIntersecting);
  }, { threshold: 0 });

  observer.observe(sentinel);
}

function bindStickyDesktopTopbar() {
  const topbar = document.querySelector('.topbar');
  const sentinel = document.querySelector('.desktop-sticky-sentinel');
  if (!topbar || !sentinel) return;

  const desktopQuery = window.matchMedia('(min-width: 981px)');
  const updateStickyState = () => {
    const isStuck = desktopQuery.matches && sentinel.getBoundingClientRect().top <= 10;
    topbar.classList.toggle('is-stuck', isStuck);
  };

  window.addEventListener('scroll', updateStickyState, { passive: true });
  window.addEventListener('resize', updateStickyState);
  updateStickyState();
}

function bindDesktopWheelSmoothing() {
  if (prefersReducedMotion) return;

  let animationFrame = 0;
  let restoreTimer = 0;
  let currentY = window.scrollY;
  let targetY = currentY;
  let previousScrollBehavior = '';
  let customScrollActive = false;

  function getWheelDistance(event) {
    const direction = Math.sign(event.deltaY || -event.wheelDelta || 0);
    if (!direction) return 0;

    const legacyDelta = Math.abs(Number(event.wheelDelta) || 0);
    const notchCount = legacyDelta >= 120
      ? Math.max(1, Math.round(legacyDelta / 120))
      : 0;

    if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
      return direction * DESKTOP_WHEEL_STEP_PX * (notchCount || 1);
    }

    if (notchCount) {
      return direction * DESKTOP_WHEEL_STEP_PX * notchCount;
    }

    return event.deltaY;
  }

  function animateScroll() {
    currentY += (targetY - currentY) * 0.075;

    if (Math.abs(targetY - currentY) < 0.35) {
      currentY = targetY;
      window.scrollTo(0, currentY);
      animationFrame = 0;
      restoreTimer = window.setTimeout(() => {
        if (animationFrame) return;
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
        customScrollActive = false;
        restoreTimer = 0;
      }, 140);
      return;
    }

    window.scrollTo(0, currentY);
    animationFrame = window.requestAnimationFrame(animateScroll);
  }

  window.addEventListener('wheel', (event) => {
    if (
      window.matchMedia('(max-width: 700px)').matches ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.shiftKey ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ) {
      return;
    }

    if (event.target instanceof Element && event.target.closest('dialog[open], textarea, select, [data-native-scroll]')) {
      return;
    }

    const deltaY = getWheelDistance(event);
    if (!deltaY) return;

    event.preventDefault();

    if (!customScrollActive) {
      previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      currentY = window.scrollY;
      targetY = currentY;
      customScrollActive = true;
    }

    if (restoreTimer) {
      window.clearTimeout(restoreTimer);
      restoreTimer = 0;
    }

    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    targetY = Math.max(0, Math.min(maxScrollY, targetY + deltaY));

    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(animateScroll);
    }
  }, { passive: false });
}

function renderPagination() {
  const dots = products
    .map(
      (_, index) =>
        `<button class="dot ${index === activeIndex ? 'active' : ''}" type="button" aria-label="Go to product ${index + 1}" data-index="${index}"></button>`
    )
    .join('');

  pagination.innerHTML = `
    <div class="pagination-dots">${dots}</div>
    <span class="pagination-progress" aria-hidden="true"><span class="pagination-progress-fill"></span></span>
  `;

  for (const dot of pagination.querySelectorAll('.dot')) {
    dot.addEventListener('click', () => {
      const nextIndex = Number(dot.dataset.index);
      goToSlide(nextIndex, true);
    });
  }
}

function fitHeroDisplayWord() {
  const headlineWrap = document.querySelector('.hero-headline');
  const headlineText = displayWord?.dataset.headlineText?.trim();
  if (!headlineWrap || !headlineText) return;

  displayWord.style.removeProperty('font-size');
  const styles = getComputedStyle(displayWord);
  const baseFontSize = Number.parseFloat(styles.fontSize);
  const availableWidth = headlineWrap.clientWidth * 0.96;
  if (!baseFontSize || !availableWidth || !headlineWrap.clientHeight) return;

  const context = document.createElement('canvas').getContext('2d');
  if (!context) return;
  context.font = `${styles.fontWeight} ${baseFontSize}px ${styles.fontFamily}`;

  const words = headlineText.toLocaleUpperCase().split(/\s+/);
  const tracking = Number.parseFloat(styles.letterSpacing) || 0;
  const measure = (text) => context.measureText(text).width + Math.max(0, text.length - 1) * tracking;
  const useTwoLines = words.length > 2 || headlineText.length > 16;
  let lines = [headlineText.toLocaleUpperCase()];

  if (useTwoLines && words.length > 1) {
    let bestSplit = 1;
    let narrowestSplit = Infinity;
    for (let split = 1; split < words.length; split += 1) {
      const lineWidth = Math.max(
        measure(words.slice(0, split).join(' ')),
        measure(words.slice(split).join(' '))
      );
      if (lineWidth < narrowestSplit) {
        narrowestSplit = lineWidth;
        bestSplit = split;
      }
    }
    lines = [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')];
  }

  displayWord.replaceChildren();
  lines.forEach((line, index) => {
    if (index) displayWord.append(document.createElement('br'));
    displayWord.append(document.createTextNode(line));
  });

  const naturalWidth = Math.max(...lines.map(measure));
  const maxFontSize = headlineWrap.clientHeight * 0.92 / (lines.length * 0.78);
  const fittedFontSize = Math.min(baseFontSize * (availableWidth / naturalWidth), maxFontSize);
  displayWord.style.fontSize = `${fittedFontSize}px`;
}

function fitHeroProductName() {
  if (!productName) return;

  productName.style.removeProperty('font-size');
  const styles = getComputedStyle(productName);
  const baseFontSize = Number.parseFloat(styles.fontSize);
  const availableWidth = productName.clientWidth;
  if (!baseFontSize || !availableWidth) return;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;

  context.font = `${styles.fontWeight} ${baseFontSize}px ${styles.fontFamily}`;
  const text = productName.textContent.trim().toLocaleUpperCase();
  const words = text.split(/\s+/);
  const tracking = Number.parseFloat(styles.letterSpacing) || 0;
  const measure = (value) => {
    const length = value.length;
    return context.measureText(value).width + Math.max(0, length - 1) * tracking;
  };

  if (measure(text) <= availableWidth) return;

  let narrowestTwoLineLayout = measure(text);
  for (let split = 1; split < words.length; split += 1) {
    const lineWidth = Math.max(
      measure(words.slice(0, split).join(' ')),
      measure(words.slice(split).join(' '))
    );
    narrowestTwoLineLayout = Math.min(narrowestTwoLineLayout, lineWidth);
  }

  const fittedFontSize = baseFontSize * Math.min(1, availableWidth / narrowestTwoLineLayout);
  productName.style.fontSize = `${fittedFontSize}px`;
}

function bindHeroDisplayWordFit() {
  window.addEventListener('resize', () => {
    fitHeroDisplayWord();
    fitHeroProductName();
  }, { passive: true });
  document.fonts?.ready.then(() => {
    fitHeroDisplayWord();
    fitHeroProductName();
  });
}

function updateProduct(product) {
  productName.textContent = product.name;
  fitHeroProductName();
  productTag.textContent = product.tag;
  productDescription.textContent = product.description;
  productPrice.textContent = Number.isFinite(product.price) ? String(product.price) : 'N/A';
  productCurrency.hidden = !Number.isFinite(product.price);
  if (Number.isFinite(product.price)) productCurrency.textContent = currencySymbol(product);
  floatingBadge.textContent = product.badge;
  displayWord.dataset.headlineText = product.displayWord || product.name;
  fitHeroDisplayWord();

  productImage.onerror = () => {
    productImage.src = product.fallbackImage;
    productImage.onerror = null;
  };
  productImage.src = product.image;
  productImage.alt = `${product.name} cookie`;

  root.style.setProperty('--bg-start', product.bgStart);
  root.style.setProperty('--bg-end', product.bgEnd);
  root.style.setProperty('--accent', product.accent);
  applySupportingSectionPalette(product.bgStart, product.bgEnd);
  root.style.setProperty('--panel', 'rgba(255,255,255,0.18)');
  root.style.setProperty('--panel-border', 'rgba(255,255,255,0.22)');
  try {
    localStorage.setItem('selahHeroPalette', JSON.stringify({ bgStart: product.bgStart, bgEnd: product.bgEnd }));
    if (product.id) localStorage.setItem('selahHeroProductId', product.id);
  } catch {
    // The hero still works normally when browser storage is unavailable.
  }
}

function goToSlide(nextIndex, userInitiated = false, direction = null) {
  if (isAnimating || nextIndex === activeIndex) {
    return;
  }

  if (userInitiated) pauseAutoRotate();

  const slideDirection = direction ?? (nextIndex > activeIndex ? 1 : -1);
  isAnimating = true;
  hero.dataset.animating = 'true';
  hero.dataset.direction = slideDirection > 0 ? 'next' : 'previous';

  activeIndex = (nextIndex + products.length) % products.length;
  updateProduct(products[activeIndex]);
  renderPagination();

  window.setTimeout(() => {
    hero.dataset.animating = 'false';
    isAnimating = false;
    if (userInitiated) {
      autoRotateRemaining = 6000;
      if (!pointerPauseTargets.size && !focusPauseTargets.size) {
        restartAutoRotate(true);
      }
    }
  }, 720);
}

function step(direction) {
  const nextIndex = (activeIndex + direction + products.length) % products.length;
  goToSlide(nextIndex, true, direction);
}

function restartAutoRotate(resetCountdown = false) {
  if (autoRotateTimer && !resetCountdown) {
    return;
  }

  if (autoRotateTimer) {
    clearTimeout(autoRotateTimer);
    autoRotateTimer = null;
  }

  if (prefersReducedMotion || products.length < 2) {
    pagination.classList.remove('is-playing', 'has-autoplay');
    pagination.classList.remove('is-paused');
    autoRotateRemaining = 6000;
    autoRotateDeadline = 0;
    return;
  }

  if (resetCountdown || autoRotateRemaining <= 0) {
    autoRotateRemaining = 6000;
  }

  pagination.classList.add('has-autoplay', 'is-playing');
  pagination.classList.remove('is-paused');
  autoRotateDeadline = performance.now() + autoRotateRemaining;
  autoRotateTimer = setTimeout(() => {
    autoRotateTimer = null;
    autoRotateDeadline = 0;
    autoRotateRemaining = 6000;
    const nextIndex = (activeIndex + 1) % products.length;
    goToSlide(nextIndex, false, 1);
    restartAutoRotate();
  }, autoRotateRemaining);
}

function pauseAutoRotate() {
  if (autoRotateTimer) {
    clearTimeout(autoRotateTimer);
    autoRotateTimer = null;
    autoRotateRemaining = Math.max(0, autoRotateDeadline - performance.now());
    autoRotateDeadline = 0;
  }
  if (pagination.classList.contains('is-playing')) {
    pagination.classList.add('is-paused');
  }
}

function resumeAutoRotateAfterInteraction() {
  if (!pointerPauseTargets.size && !focusPauseTargets.size) {
    restartAutoRotate();
  }
}

function bindArrowControls() {
  const prevButton = document.querySelector('.arrow-left');
  const nextButton = document.querySelector('.arrow-right');

  prevButton.addEventListener('click', () => step(-1));
  nextButton.addEventListener('click', () => step(1));
}

function bindKeyboardControls() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  });
}

function bindPointerControls() {
  const heroNode = document.querySelector('.hero');

  heroNode.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    startY = event.clientY;
  });

  heroNode.addEventListener('pointerup', (event) => {
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      step(deltaX < 0 ? 1 : -1);
    }
  });
}

function bindInteractionPause() {
  const pauseTargets = [document.querySelector('.hero'), document.querySelector('.topbar')];

  window.addEventListener('pointerdown', (event) => {
    lastInputWasPointer = true;
    focusPauseTargets.forEach((target) => {
      if (target.contains(event.target)) {
        focusPauseTargets.delete(target);
      }
    });
  }, true);

  window.addEventListener('keydown', () => {
    lastInputWasPointer = false;
  }, true);

  pauseTargets.forEach((target) => {
    if (!target) {
      return;
    }

    target.addEventListener('pointerenter', () => {
      pointerPauseTargets.add(target);
      pauseAutoRotate();
    });

    target.addEventListener('pointerleave', () => {
      pointerPauseTargets.delete(target);
      resumeAutoRotateAfterInteraction();
    });

    target.addEventListener('focusin', () => {
      if (lastInputWasPointer) {
        return;
      }
      focusPauseTargets.add(target);
      pauseAutoRotate();
    });

    target.addEventListener('focusout', () => {
      if (target.contains(document.activeElement)) {
        return;
      }
      focusPauseTargets.delete(target);
      resumeAutoRotateAfterInteraction();
    });
  });
}

async function init() {
  bindHeroDisplayWordFit();

  try {
    catalogCookies = await loadCookiesFromXml();
    const heroCookies = catalogCookies.filter((product) => product.heroCookie);
    products = heroCookies.length ? heroCookies : [...sampleProducts];
  } catch (error) {
    console.info('Using the built-in sample cookies because Cookies.xml could not be loaded.', error);
    catalogCookies = [...sampleProducts];
    products = [...sampleProducts];
  }

  try {
    const savedProductId = localStorage.getItem('selahHeroProductId');
    const savedIndex = products.findIndex((product) => product.id === savedProductId);
    if (savedIndex >= 0) activeIndex = savedIndex;
  } catch {
    // Keep the first cookie selected when browser storage is unavailable.
  }

  updateProduct(products[activeIndex]);
  renderPagination();
  renderCookieCatalog();
  bindCookieGridScrollbar();
  bindArrowControls();
  bindShoppingControls();
  bindStickyMobileNav();
  bindStickyDesktopTopbar();
  bindDesktopWheelSmoothing();
  bindKeyboardControls();
  bindPointerControls();
  bindInteractionPause();

  if (!prefersReducedMotion) {
    restartAutoRotate();
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.documentElement.classList.remove('is-booting');
    document.documentElement.classList.add('is-ready');
  }));
}

init();
