/**
 * FLake Lake Model - Interactive Client Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Toggle
  const toggleBtn = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', isOpen);
      toggleBtn.textContent = isOpen ? 'Close' : 'Menu';
    });
  }

  // 2. Interactive Tabs (e.g. for Test Runs)
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });

  // 3. Publications Instant Search Filter
  const papersFilterInput = document.getElementById('papers-search');
  const paperItems = document.querySelectorAll('.paper-item');
  const paperCount = document.getElementById('papers-count');

  if (papersFilterInput && paperItems.length > 0) {
    papersFilterInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      let visibleCount = 0;

      paperItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
          item.style.display = '';
          visibleCount++;
        } else {
          item.style.display = 'none';
        }
      });

      if (paperCount) {
        paperCount.textContent = `Showing ${visibleCount} of ${paperItems.length} publications`;
      }
    });
  }

  // 4. Users Instant Search Filter
  const usersFilterInput = document.getElementById('users-search');
  const userCards = document.querySelectorAll('.user-card');
  const userCount = document.getElementById('users-count');

  if (usersFilterInput && userCards.length > 0) {
    usersFilterInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      let visibleCount = 0;

      userCards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (text.includes(query)) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      if (userCount) {
        userCount.textContent = `Showing ${visibleCount} of ${userCards.length} institutions`;
      }
    });
  }

  // 5. Smooth Scroll for Anchor Links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href').substring(1);
      if (!targetId) return;
      const targetElem = document.getElementById(targetId);
      if (targetElem) {
        e.preventDefault();
        targetElem.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
