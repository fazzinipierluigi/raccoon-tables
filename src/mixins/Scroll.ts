/**
 * Raccoon Tables - Scroll mixin
 *
 * Handles scroll events from:
 *   - Native scrollbar on the body container
 *   - Mouse wheel (when body overflows but native scroll not triggered)
 *   - Touch events (swipe gesture)
 *
 * After scroll, asks the Scroller to compute the new visible row/col range,
 * then calls renderVisibleRows() only if the range actually changed.
 */

import type { RaccoonGrid } from '../RaccoonGrid.js';

type Grid = RaccoonGrid<Record<string, unknown>>;

const SCROLL_THRESHOLD = 5; // px, ignore tiny jitter

export const ScrollMixin = {
  initScrollListeners(this: Grid): void {
    if (!this.bodyEl) return;

    // Native scroll (scrollbar drag)
    this.bodyEl.addEventListener('scroll', () => this._onNativeScroll(), { passive: true });

    // Wheel
    this.bodyEl.addEventListener('wheel', (e) => this._onMouseWheel(e), { passive: false });

    // Touch
    this.bodyEl.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: true });
    this.bodyEl.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    this.bodyEl.addEventListener('touchend', () => this._onTouchEnd(), { passive: true });
  },

  _onNativeScroll(this: Grid): void {
    if (!this.bodyEl) return;
    const changed = this.scroller.onScroll(this.bodyEl.scrollTop, this.bodyEl.scrollLeft);
    this._syncHeaderScroll();
    if (!changed) return;
    const range = this.scroller.generateNewRange();
    if (range) this.renderVisibleRows();
  },

  _onMouseWheel(this: Grid, e: WheelEvent): void {
    if (e.ctrlKey) return; // allow browser zoom

    const deltaY = e.deltaY;
    const deltaX = e.deltaX;

    let prevented = false;

    if (Math.abs(deltaY) >= Math.abs(deltaX)) {
      const changed = this.scroller.deltaChange(deltaY);
      if (changed) {
        e.preventDefault();
        prevented = true;
        const range = this.scroller.generateNewRange();
        if (range) this.renderVisibleRows();
      }
    } else {
      const changed = this.scroller.horizontalDeltaChange(deltaX);
      if (changed) {
        e.preventDefault();
        prevented = true;
        const range = this.scroller.getColumnsViewRange();
        this.renderVisibleRows();
      }
    }
  },

  _touchStartY: 0,
  _touchStartX: 0,
  _touchLastY: 0,
  _touchLastX: 0,
  _touchVelocityY: 0,
  _touchVelocityX: 0,
  _touchAnimFrame: 0,

  _onTouchStart(this: Grid, e: TouchEvent): void {
    const touch = e.touches[0];
    this._touchStartY = touch.clientY;
    this._touchStartX = touch.clientX;
    this._touchLastY = touch.clientY;
    this._touchLastX = touch.clientX;
    this._touchVelocityY = 0;
    this._touchVelocityX = 0;

    if (this._touchAnimFrame) {
      cancelAnimationFrame(this._touchAnimFrame);
      this._touchAnimFrame = 0;
    }
  },

  _onTouchMove(this: Grid, e: TouchEvent): void {
    const touch = e.touches[0];
    const deltaY = this._touchLastY - touch.clientY;
    const deltaX = this._touchLastX - touch.clientX;

    this._touchVelocityY = deltaY;
    this._touchVelocityX = deltaX;
    this._touchLastY = touch.clientY;
    this._touchLastX = touch.clientX;

    const changed = Math.abs(deltaY) > Math.abs(deltaX)
      ? this.scroller.deltaChange(deltaY)
      : this.scroller.horizontalDeltaChange(deltaX);

    if (changed) {
      e.preventDefault();
      const range = this.scroller.generateNewRange();
      if (range) this.renderVisibleRows();
    }
  },

  _onTouchEnd(this: Grid): void {
    // Inertia scrolling
    const FRICTION = 0.9;
    const MIN_VELOCITY = 0.5;

    const step = () => {
      this._touchVelocityY *= FRICTION;
      this._touchVelocityX *= FRICTION;

      if (Math.abs(this._touchVelocityY) < MIN_VELOCITY && Math.abs(this._touchVelocityX) < MIN_VELOCITY) {
        this._touchAnimFrame = 0;
        return;
      }

      const changed = Math.abs(this._touchVelocityY) >= Math.abs(this._touchVelocityX)
        ? this.scroller.deltaChange(this._touchVelocityY)
        : this.scroller.horizontalDeltaChange(this._touchVelocityX);

      if (changed) {
        const range = this.scroller.generateNewRange();
        if (range) this.renderVisibleRows();
      }

      this._touchAnimFrame = requestAnimationFrame(step);
    };

    this._touchAnimFrame = requestAnimationFrame(step);
  },
};
