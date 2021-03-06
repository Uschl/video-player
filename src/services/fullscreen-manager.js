export class FullscreenManager {
  /**
   * Initializes a new FullscreenManager instance.
   * @param {HTMLElement} fullscreenElement The element that should be displayed full-screen.
   * @return {FullscreenManager}  The new FullscreenManager instance.
   */
  constructor(fullscreenElement) {
    this.fullscreenElement = fullscreenElement;
    this.fullscreenChangedCallbacks = new Set();

    this._oldBodyPosition = '';

    // Attatch event handler for fullscreenchange
    this.fullscreenElement.addEventListener('fullscreenchange', () => {
      this._fullScreenChanged(document.fullscreen);
    });
    this.fullscreenElement.addEventListener('webkitfullscreenchange', () => {
      this._fullScreenChanged(document.webkitIsFullScreen);
    });
    // Firefox for some reason needs to attach the event to document
    document.addEventListener('mozfullscreenchange', () => {
      this._fullScreenChanged(document.mozFullScreen);
    });
    this.fullscreenElement.addEventListener('msfullscreenchange', () => {
      this._fullScreenChanged(document.msFullscreenElement);
    });
  }

  /**
   * Displays the element in fullscreen.
   * @return {void}
   */
  enterFullscreen() {
    if (this.fullscreenElement.requestFullscreen) {
      this.fullscreenElement.requestFullscreen();
    } else if (this.fullscreenElement.mozRequestFullScreen) {
      this.fullscreenElement.mozRequestFullScreen();
    } else if (this.fullscreenElement.webkitRequestFullScreen) {
      this.fullscreenElement.webkitRequestFullScreen();
    } else if (this.fullscreenElement.msRequestFullscreen) {
      this.fullscreenElement.msRequestFullscreen();
    } else {
      // This is primarily for iOS since iOS doesn't have a real full screen
      // mode so we have to fake it by appending a special iOS class that just
      // stretches the fullscreenElement to occupy 100% of width and height
      this.fullscreenElement.classList.add('fake-fullscreen');
      this._oldBodyPosition = document.body.style.position;
      document.body.style.position = 'fixed';
    }
  }

  /**
   * Exits the fullscreen.
   * @return {void}
   */
  exitFullscreen() {
    if (document.exitFullscreen) {
      // Firefox likes to print a error message here. Prevent by providing own error handler.
      document.exitFullscreen().catch(() => {});
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitCancelFullScreen) {
      document.webkitCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else {
      this.fullscreenElement.classList.remove('fake-fullscreen');
      document.body.style.position = this._oldBodyPosition;
    }
  }

  /**
   * Register callback that is called when the browser is switched
   * to/out-of fullscreen mode.
   * @param  {Function} callback The callback that should be registered.
   * @return {void}
   */
  onFullscreenChanged(callback) {
    this.fullscreenChangedCallbacks.add(callback);
  }

  /**
   * Unregister callback.
   * @param  {Function} callback The callback that should be unregistered.
   * @return {void}
   */
  offFullscreenChanged(callback) {
    this.fullscreenChangedCallbacks.delete(callback);
  }

  /**
   * Calls all registered callbacks to notify fullscreen change.
   * @param  {Boolean} fullscreen A value determining whether the fullscreen is active or not.
   * @return {void}
   */
  _fullScreenChanged(fullscreen) {
    for(let callback of this.fullscreenChangedCallbacks) {
      callback(fullscreen);
    }
  }
}
