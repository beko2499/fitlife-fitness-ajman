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

    const selectOption = (select, value) => {
      const wanted = value?.trim().toLowerCase();
      if (!wanted || !select) return;
      const option = [...select.options].find((item) =>
        item.value.toLowerCase() === wanted || item.textContent.trim().toLowerCase() === wanted
      );
      if (option) select.value = option.value;
    };

    const openDialog = (trigger, name) => {
      if (!dialog || dialogIsOpen) return;
      setMenu(false, false);
      dialogReturnFocus = trigger || document.activeElement;
      selectOption(planSelect, trigger?.dataset.plan);
      selectOption(form?.elements.namedItem('goal'), trigger?.dataset.goal);
      const nameField = form?.elements.namedItem('name');
      if (name && nameField) nameField.value = name;
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

    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    const selectTab = (tabs, index) => tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    // Arrow, Home and End keys move between tabs, as in a standard tablist.
    const tabKeys = (tabs, activate) => (event) => {
      const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      const index = tabs.indexOf(event.currentTarget);
      let next;
      if (event.key in steps) next = (index + steps[event.key] + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(next);
      tabs[next].focus();
    };
    const bindTabs = (tabs, activate) => tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(index));
      tab.addEventListener('keydown', tabKeys(tabs, activate));
    });

    const trainers = $('#trainers');
    const stage = trainers?.querySelector('.trainer-stage');
    if (stage) {
      const slides = [...stage.querySelectorAll('.trainer-slide')];
      const indexLabel = $('#trainer-index');
      const roleLabel = $('#trainer-role');
      const book = $('#trainer-book');
      let current = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
      const show = (index, direction) => {
        const next = (index + slides.length) % slides.length;
        if (next === current) return;
        stage.style.setProperty('--dir', String(direction));
        slides[current].classList.remove('is-active');
        slides[next].classList.add('is-active');
        current = next;
        if (indexLabel) indexLabel.textContent = String(next + 1).padStart(2, '0');
        if (roleLabel) roleLabel.textContent = slides[next].dataset.role || '';
        if (book) book.dataset.goal = slides[next].dataset.goal || '';
      };
      stage.querySelector('.trainer-arrow.prev')?.addEventListener('click', () => show(current - 1, -1));
      stage.querySelector('.trainer-arrow.next')?.addEventListener('click', () => show(current + 1, 1));
      stage.addEventListener('keydown', (event) => {
        if (event.target !== stage) return;
        if (event.key === 'ArrowLeft') show(current - 1, -1);
        else if (event.key === 'ArrowRight') show(current + 1, 1);
        else return;
        event.preventDefault();
      });

      let startX = null;
      let dragged = 0;
      const endDrag = () => {
        if (startX === null) return;
        startX = null;
        stage.classList.remove('is-dragging');
        stage.style.removeProperty('--drag');
        if (Math.abs(dragged) > 50) show(current + (dragged < 0 ? 1 : -1), dragged < 0 ? 1 : -1);
      };
      stage.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || event.target.closest('button')) return;
        startX = event.clientX;
        dragged = 0;
      });
      stage.addEventListener('pointermove', (event) => {
        if (startX === null) return;
        if (event.pointerType === 'mouse' && !event.buttons) {
          endDrag();
          return;
        }
        dragged = event.clientX - startX;
        if (Math.abs(dragged) < 8) return;
        if (!stage.classList.contains('is-dragging')) {
          stage.classList.add('is-dragging');
          try {
            stage.setPointerCapture(event.pointerId);
          } catch {
            // Capture is only a nicety; the drag still works without it.
          }
        }
        // The artwork is drawn in a 1072-unit coordinate space, so convert screen pixels to it.
        const artWidth = slides[current].querySelector('.trainer-art')?.getBoundingClientRect().width || 1072;
        stage.style.setProperty('--drag', String(dragged * 1072 / artWidth));
      });
      stage.addEventListener('pointerup', endDrag);
      stage.addEventListener('pointercancel', endDrag);
      stage.addEventListener('lostpointercapture', endDrag);
      // A drag must not also count as a click on the badge or a hotspot.
      stage.addEventListener('click', (event) => {
        if (Math.abs(dragged) <= 8) return;
        event.preventDefault();
        event.stopPropagation();
        dragged = 0;
      }, true);
    }

    const planTrack = $('#plan-track');
    const planDots = $('#plan-dots');
    if (planTrack && planDots) {
      const cards = [...planTrack.children];
      let pages = 0;
      let perPage = 1;
      let step = 1;
      const activePage = () => {
        if (planTrack.scrollLeft >= planTrack.scrollWidth - planTrack.clientWidth - 4) return pages - 1;
        return Math.round(planTrack.scrollLeft / (perPage * step));
      };
      const markDots = () => {
        const active = activePage();
        [...planDots.children].forEach((dot, i) => dot.setAttribute('aria-selected', String(i === active)));
      };
      const buildDots = () => {
        const style = getComputedStyle(planTrack);
        const gap = parseFloat(style.columnGap) || 0;
        const inner = planTrack.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        step = cards[0].offsetWidth + gap;
        perPage = Math.max(1, Math.round((inner + gap) / step));
        const count = Math.ceil(cards.length / perPage);
        if (count !== pages) {
          pages = count;
          planDots.replaceChildren(...Array.from({ length: count }, (_, page) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.setAttribute('aria-label', `Show membership page ${page + 1} of ${count}`);
            dot.addEventListener('click', () => planTrack.scrollTo({ left: page * perPage * step, behavior: scrollBehavior() }));
            return dot;
          }));
        }
        planDots.hidden = count < 2;
        markDots();
      };
      planTrack.addEventListener('scroll', () => requestAnimationFrame(markDots), { passive: true });
      window.addEventListener('resize', buildDots);
      buildDots();
    }

    const marquee = $('#product-marquee');
    const productTrack = marquee?.querySelector('.product-track');
    if (marquee && productTrack) {
      const originals = [...productTrack.children];
      // A second, hidden copy of the cards lets the row loop without a visible jump.
      originals.forEach((card) => {
        const copy = card.cloneNode(true);
        copy.setAttribute('aria-hidden', 'true');
        copy.inert = true;
        productTrack.append(copy);
      });
      let loopWidth = 0;
      let position = 0;
      let last = null;
      let frame = null;
      let hovering = false;
      let pausedUntil = 0;
      const measure = () => {
        loopWidth = productTrack.children[originals.length].offsetLeft - productTrack.children[0].offsetLeft;
      };
      const wrap = () => {
        if (!loopWidth) return;
        if (marquee.scrollLeft >= loopWidth) marquee.scrollLeft -= loopWidth;
        else if (marquee.scrollLeft <= 0) marquee.scrollLeft += loopWidth;
      };
      const pause = (ms = 2500) => {
        pausedUntil = performance.now() + ms;
      };
      const tick = (now) => {
        const running = !hovering && now > pausedUntil && !marquee.contains(document.activeElement);
        if (running && last !== null) {
          // Pick up from wherever a swipe or keyboard scroll left the row.
          if (Math.abs(marquee.scrollLeft - position) > 2) position = marquee.scrollLeft;
          position += (now - last) * 0.04;
          if (loopWidth && position >= loopWidth) position -= loopWidth;
          marquee.scrollLeft = position;
        } else {
          position = marquee.scrollLeft;
        }
        last = now;
        frame = requestAnimationFrame(tick);
      };
      const start = () => {
        if (frame === null && !reducedMotion()) {
          last = null;
          frame = requestAnimationFrame(tick);
        }
      };
      const stop = () => {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
      };
      marquee.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') hovering = true;
      });
      marquee.addEventListener('pointerleave', () => {
        hovering = false;
      });
      ['pointerdown', 'wheel', 'touchmove', 'keydown'].forEach((type) => {
        marquee.addEventListener(type, () => pause(), { passive: true });
      });
      marquee.addEventListener('scroll', wrap, { passive: true });
      window.addEventListener('resize', measure);
      measure();
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(marquee);
      } else {
        start();
      }
    }

    const programTabs = [...document.querySelectorAll('.program-tabs [role="tab"]')];
    const programTitle = $('#program-title');
    const programList = $('#program-list');
    bindTabs(programTabs, (index) => {
      selectTab(programTabs, index);
      if (programTitle) programTitle.textContent = programTabs[index].dataset.title || '';
      programList?.replaceChildren(...(programTabs[index].dataset.list || '').split('|').filter(Boolean).map((service) => {
        const item = document.createElement('li');
        item.textContent = service;
        return item;
      }));
    });

    const visitTabs = [...document.querySelectorAll('.visit-info [role="tab"]')];
    bindTabs(visitTabs, (index) => {
      selectTab(visitTabs, index);
      visitTabs.forEach((tab, i) => {
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = i !== index;
      });
    });

    $('#cta-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = String(new FormData(event.currentTarget).get('name') || '').trim().slice(0, 80);
      openDialog(event.submitter || event.currentTarget, name);
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
