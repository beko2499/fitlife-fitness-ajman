(() => {
  'use strict';

  const init = () => {
    const $ = (selector) => document.querySelector(selector);
    const menuButton = $('#menu-toggle');
    const menu = $('#menu-panel');
    const menuClose = $('#menu-close');
    const dialog = $('#join-dialog');
    const form = $('#join-form');
    const planSelect = $('#join-plan');
    const locks = new Set();
    let savedOverflow;
    let menuReturnFocus;
    let dialogReturnFocus;
    let dialogIsOpen = false;

    const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const scrollBehavior = () => reducedMotion() ? 'auto' : 'smooth';
    const focus = (element) => element?.focus({ preventScroll: true });
    const visibleControls = (container) => [...container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((element) => element.getClientRects().length && !element.closest('[hidden], [inert]'));

    const lockScroll = (reason, enabled) => {
      if (enabled) {
        if (!locks.size) {
          savedOverflow = [document.documentElement.style.overflow, document.body.style.overflow];
        }
        locks.add(reason);
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
      } else {
        locks.delete(reason);
        if (!locks.size && savedOverflow) {
          [document.documentElement.style.overflow, document.body.style.overflow] = savedOverflow;
          savedOverflow = undefined;
        }
      }
    };

    const setMenu = (open, restoreFocus = true) => {
      if (!menu || !menuButton || open === !menu.hidden) return;
      if (open) menuReturnFocus = document.activeElement;
      menu.hidden = !open;
      menuButton.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
      lockScroll('menu', open);
      if (open) {
        focus(menuClose || visibleControls(menu)[0] || menuButton);
      } else if (restoreFocus) {
        focus(menuReturnFocus?.isConnected ? menuReturnFocus : menuButton);
      }
    };

    const splash = $('#splash');
    if (splash) {
      let entered = false;
      let loaded = document.readyState === 'complete';
      let leaving = false;
      const leave = () => {
        if (leaving) return;
        leaving = true;
        lockScroll('splash', false);
        document.documentElement.classList.add('splash-reveal');
        splash.classList.add('is-leaving');
        const remove = () => splash.remove();
        splash.querySelector('.splash-curtain-red')?.addEventListener('animationend', remove, { once: true });
        setTimeout(remove, reducedMotion() ? 0 : 1400);
      };
      const ready = () => {
        if (entered && loaded) setTimeout(leave, 150);
      };
      const markEntered = () => {
        entered = true;
        ready();
      };
      const canvas = splash.querySelector('.splash-halftone');
      const context = canvas?.getContext('2d');
      if (context) {
        const clamp = (value) => Math.min(1, Math.max(0, value));
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const pitch = Math.max(9, Math.min(15, Math.min(width, height) / 64));
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.scale(ratio, ratio);
        context.fillStyle = 'rgba(196, 94, 66, .42)';
        const dots = [];
        for (let x = (width / 2) % pitch; x < width; x += pitch) {
          for (let y = (height / 2) % pitch; y < height; y += pitch) {
            const distance = Math.hypot((x - width / 2) / width, (y - height / 2) / height) * 1.6;
            const falloff = 1 - clamp((distance - 0.22) / 0.85);
            const size = falloff ** 1.5 * (0.3 + 0.7 * clamp((distance - 0.08) / 0.2));
            if (size > 0) dots.push([x, y, distance, size]);
          }
        }
        // Run on the same clock as the CSS logo animation so the halftone pulse lands with the check mark.
        const clock = splash.querySelector('.splash-logo')?.getAnimations?.()[0];
        const origin = performance.now() - (Number(clock?.currentTime) || 0);
        const draw = (now) => {
          if (!splash.isConnected) return;
          const time = reducedMotion() ? Infinity : now - origin;
          context.clearRect(0, 0, width, height);
          context.beginPath();
          dots.forEach(([x, y, distance, size]) => {
            const shown = 1 - (1 - clamp((time - 100 - distance * 700) / 500)) ** 3;
            const pulse = time > 980 && time < 2200
              ? Math.exp(-(((distance - (time - 980) / 600) / 0.1) ** 2)) * (1 - (time - 980) / 1220)
              : 0;
            const radius = pitch * 0.47 * size * shown * (1 + 0.55 * pulse);
            if (radius > 0.3) {
              context.moveTo(x + radius, y);
              context.arc(x, y, radius, 0, Math.PI * 2);
            }
          });
          context.fill();
          if (time < 2200) requestAnimationFrame(draw);
        };
        draw(performance.now());
      }

      lockScroll('splash', true);
      if (reducedMotion()) setTimeout(markEntered, 600);
      else splash.querySelector('.splash-glint')?.addEventListener('animationend', markEntered, { once: true });
      if (!loaded) window.addEventListener('load', () => {
        loaded = true;
        ready();
      }, { once: true });
      setTimeout(leave, 4500);
    }

    if (menu && menuButton) {
      menuButton.setAttribute('aria-expanded', String(!menu.hidden));
      menuButton.addEventListener('click', () => setMenu(menu.hidden));
      menuClose?.addEventListener('click', () => setMenu(false));
      menu.addEventListener('click', (event) => {
        if (event.target.closest('a[href]')) setMenu(false, false);
      });
    }

    const finishDialogClose = () => {
      if (!dialogIsOpen) return;
      dialogIsOpen = false;
      document.body.classList.remove('dialog-open');
      lockScroll('dialog', false);
      focus(dialogReturnFocus?.isConnected ? dialogReturnFocus : null);
      dialogReturnFocus = undefined;
    };

    const closeDialog = () => {
      if (!dialog) return;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      finishDialogClose();
    };

    const openDialog = (trigger) => {
      if (!dialog || dialogIsOpen) return;
      setMenu(false, false);
      dialogReturnFocus = trigger || document.activeElement;
      const requestedPlan = trigger?.dataset.plan?.trim().toLowerCase();
      if (requestedPlan && planSelect) {
        const option = [...planSelect.options].find((item) =>
          item.value.toLowerCase() === requestedPlan || item.textContent.trim().toLowerCase() === requestedPlan
        );
        if (option) planSelect.value = option.value;
      }
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else {
        dialog.setAttribute('open', '');
        dialog.setAttribute('aria-modal', 'true');
      }
      dialogIsOpen = true;
      document.body.classList.add('dialog-open');
      lockScroll('dialog', true);
      focus(form?.elements.namedItem('name') || visibleControls(dialog)[0]);
    };

    document.querySelectorAll('[data-join]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        openDialog(button);
      });
    });
    $('#join-close')?.addEventListener('click', closeDialog);
    dialog?.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog();
    });
    dialog?.addEventListener('close', () => {
      if (!dialog.open) finishDialogClose();
    });
    dialog?.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
    });

    const nameInput = form?.elements.namedItem('name');
    nameInput?.addEventListener('input', () => nameInput.setCustomValidity(''));
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      nameInput?.setCustomValidity(name ? '' : 'Please enter your name.');
      if (!form.reportValidity()) return;
      const membership = String(data.get('plan') || planSelect?.value || '').trim();
      const goal = String(data.get('goal') || '').trim();
      const message = `Hello FitLife Fitness! My name is ${name}. I would like to enquire about ${membership || 'a membership'}.${goal ? ` My fitness goal is: ${goal}.` : ''} Please share details and availability.`;
      const url = `https://wa.me/971567704523?text=${encodeURIComponent(message)}`;
      const whatsappWindow = window.open('about:blank', '_blank');
      closeDialog();
      if (whatsappWindow) {
        whatsappWindow.opener = null;
        whatsappWindow.location.replace(url);
      } else {
        window.location.assign(url);
      }
    });

    document.addEventListener('keydown', (event) => {
      const activeOverlay = dialogIsOpen ? dialog : menu && !menu.hidden ? menu : null;
      if (!activeOverlay) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (dialogIsOpen) closeDialog();
        else setMenu(false);
      } else if (event.key === 'Tab') {
        const controls = visibleControls(activeOverlay);
        if (!controls.length) {
          event.preventDefault();
          return;
        }
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !activeOverlay.contains(document.activeElement))) {
          event.preventDefault();
          focus(last);
        } else if (!event.shiftKey && (document.activeElement === last || !activeOverlay.contains(document.activeElement))) {
          event.preventDefault();
          focus(first);
        }
      }
    });

    $('#view-programs')?.addEventListener('click', (event) => {
      event.preventDefault();
      document.querySelectorAll('details.program-item').forEach((program) => { program.open = true; });
      $('#programs')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    });
    $('#back-top')?.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    });
    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    const reveals = [...document.querySelectorAll('.reveal')];
    const showAll = () => reveals.forEach((element) => {
      element.classList.remove('reveal-ready');
      element.classList.add('is-visible');
    });
    if (reducedMotion() || !('IntersectionObserver' in window)) showAll();
    else {
      let observer;
      try {
        observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
        }, { threshold: 0.08 });
        reveals.forEach((element) => {
          observer.observe(element);
          element.classList.add('reveal-ready');
        });
      } catch {
        observer?.disconnect();
        showAll();
      }
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
