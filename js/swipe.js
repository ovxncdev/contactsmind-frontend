// swipe.js - Swipe to Delete

let touchStartX = 0;
let touchCurrentX = 0;
let swipingCard = null;
const SWIPE_THRESHOLD = 100;

function initSwipeToDelete() {
  const grid = document.getElementById('contacts-grid');
  if (!grid) return;
  
  grid.removeEventListener('touchstart', handleTouchStart);
  grid.removeEventListener('touchmove', handleTouchMove);
  grid.removeEventListener('touchend', handleTouchEnd);
  
  grid.addEventListener('touchstart', handleTouchStart, { passive: true });
  grid.addEventListener('touchmove', handleTouchMove, { passive: false });
  grid.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function handleTouchStart(e) {
  const card = e.target.closest('.contact-card');
  if (!card) return;
  touchStartX = e.touches[0].clientX;
  touchCurrentX = 0;
  swipingCard = card;
}

function handleTouchMove(e) {
  if (!swipingCard) return;
  touchCurrentX = e.touches[0].clientX;
  const diffX = touchStartX - touchCurrentX;
  if (diffX > 0) {
    e.preventDefault();
    const moveX = Math.min(diffX, 150);
    swipingCard.style.transform = `translateX(-${moveX}px)`;
    swipingCard.classList.add('swiping');
  }
}

function handleTouchEnd() {
  if (!swipingCard) return;
  const diffX = touchStartX - touchCurrentX;
  
  if (diffX > SWIPE_THRESHOLD && touchCurrentX !== 0) {
    const index = swipingCard.dataset.index;
    const contact = contacts[index];
    if (contact) {
      if (navigator.vibrate) navigator.vibrate(50);
      swipingCard.style.transform = 'translateX(-100%)';
      swipingCard.style.opacity = '0';
      setTimeout(() => deleteContact(contact._id || contact.id), 200);
    }
  } else {
    swipingCard.style.transform = '';
    swipingCard.classList.remove('swiping');
  }
  
  swipingCard = null;
  touchStartX = 0;
  touchCurrentX = 0;
}