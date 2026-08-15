/**
 * Apple Studio Micro-Toast Notification System
 */
export class Toast {
  private static container: HTMLElement | null = null;

  private static ensureContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'pm-toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  public static show(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    duration = 3200
  ): void {
    const container = this.ensureContainer();

    const toast = document.createElement('div');
    toast.className = `pm-toast pm-toast-${type}`;

    let icon = '✦';
    if (type === 'success') icon = '✓';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'error') icon = '✕';

    toast.innerHTML = `
      <span class="pm-toast-icon">${icon}</span>
      <span class="pm-toast-text">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
      toast.classList.add('pm-toast-visible');
    });

    // Auto dismiss
    setTimeout(() => {
      toast.classList.remove('pm-toast-visible');
      toast.classList.add('pm-toast-leaving');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  public static info(msg: string): void {
    this.show(msg, 'info');
  }

  public static success(msg: string): void {
    this.show(msg, 'success');
  }

  public static warning(msg: string): void {
    this.show(msg, 'warning', 4500);
  }

  public static error(msg: string): void {
    this.show(msg, 'error', 5000);
  }

  private static escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
