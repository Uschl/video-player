import {ANALYTICS_TOPICS, PLAY_STATES} from '../constants.js';

export class AnalyticsManager {
  /**
   * Initializes a new AnalyticsManager instance.
   * @param {VideoPlayer} videoPlayer  The VideoPlayer that dispatches the events.
   * @param {StateManager} stateManager  The common StateManager object.
   * @returns {AnalyticsManager}  The new AnalyticsManager instance.
   */
  constructor(videoPlayer, stateManager) {
    this.videoPlayer = videoPlayer;
    this.stateManager = stateManager;

    window.onunload = this._handleWindowUnload.bind(this);
    this._bindOrientationChange();
  }

  /**
   * Fires an event without changin the state.
   * @param {Object} options Options for the event
   * @param {Object} afterStates New states to be published by the event
   * @returns {void}
   */
  newEvent(options, afterStates) {
    let baseEventData = this._getBaseEventData();
    this._fireEvent(options.verb, baseEventData, {}, afterStates);
  }

  /**
   * Changes the given state, tracks the change and fire an analytics event.
   * @param {string} changeFunction The name of ste StateManager's methos to be executed
   * @param {Object} changeParameters An Array of parameters for the changeFunction
   * @param {Object} options Further options for the state change
   * @returns {void}
   */
  changeState(changeFunction, changeParameters, options) {
    let baseEventData = this._getBaseEventData();
    let beforeStates = {};
    switch (options.verb) {
      case ANALYTICS_TOPICS.VIDEO_SEEK:
        beforeStates.oldCurrentTime = this.stateManager.state.position;
        break;
      case ANALYTICS_TOPICS.PLAY_PAUSE:
        beforeStates.verb = (this.stateManager.state.playState === PLAY_STATES.PLAYING) ? ANALYTICS_TOPICS.VIDEO_PAUSE : ANALYTICS_TOPICS.VIDEO_PLAY;
        break;
      case ANALYTICS_TOPICS.VIDEO_CHANGE_SPEED:
        beforeStates.oldCurrentSpeed = this.stateManager.state.playbackRate;
        break;
      case ANALYTICS_TOPICS.VIDEO_CHANGE_QUALITY:
        beforeStates.oldCurrentQuality = this.stateManager.state.quality;
        break;
      case ANALYTICS_TOPICS.VIDEO_SLIDE_SEEK:
        beforeStates.oldCurrentTime = this.stateManager.state.position;
        beforeStates.oldCurrentSlide = this._getActiveSlide();
        break;
      case ANALYTICS_TOPICS.VIDEO_TRANSCRIPT_SEEK:
        beforeStates.oldCurrentTime = this.stateManager.state.position;
        beforeStates.oldCurrentSubtitleIdentifier = this._getCueIdentifier(this._getActiveCue());
        beforeStates.currentTranscriptLanguage = this.stateManager.state.captionLanguage;
        break;
      case ANALYTICS_TOPICS.VIDEO_CHAPTER_SEEK:
        beforeStates.oldCurrentTime = this.stateManager.state.position;
        beforeStates.oldCurrentChapter = this._getActiveChapter();
        break;
      case ANALYTICS_TOPICS.VIDEO_VOLUME_CHANGE:
        beforeStates.oldCurrentVolume = this.stateManager.state.volume;
        beforeStates.oldCurrentMuted = this.stateManager.state.muted;
        break;
    }

    this.stateManager[changeFunction](...changeParameters);

    let afterStates = {};
    switch (options.verb) {
      case ANALYTICS_TOPICS.VIDEO_SEEK:
        afterStates.newCurrentTime = this.stateManager.state.position;
        break;
      case ANALYTICS_TOPICS.VIDEO_FULLSCREEN:
        afterStates.newCurrentFullscreen = this._getFullscreenMode();
        break;
      case ANALYTICS_TOPICS.VIDEO_CHANGE_SPEED:
        afterStates.newCurrentSpeed = this.stateManager.state.playbackRate;
        break;
      case ANALYTICS_TOPICS.VIDEO_CHANGE_QUALITY:
        afterStates.newCurrentQuality = this.stateManager.state.quality;
        break;
      case ANALYTICS_TOPICS.VIDEO_SLIDE_SEEK:
        afterStates.newCurrentTime = this.stateManager.state.position;
        afterStates.newCurrentSlide = this._getActiveSlide();
        break;
      case ANALYTICS_TOPICS.VIDEO_TRANSCRIPT_SEEK:
        afterStates.newCurrentTime = this.stateManager.state.position;
        afterStates.newCurrentSubtitleIdentifier = this._getCueIdentifier(this._getActiveCue());
        break;
      case ANALYTICS_TOPICS.VIDEO_CHAPTER:
        afterStates.currentChapterStatus = this.stateManager.state.isChapterListShown;
        break;
      case ANALYTICS_TOPICS.VIDEO_CHAPTER_SEEK:
        afterStates.newCurrentTime = this.stateManager.state.position;
        afterStates.newCurrentChapter = this._getActiveChapter();
        break;
      case ANALYTICS_TOPICS.VIDEO_DUAL_STREAM_CHANGE:
        afterStates.newCurrentDualStreamStatus = this._getDualStreamStatus();
        break;
      case ANALYTICS_TOPICS.VIDEO_VOLUME_CHANGE:
        afterStates.newCurrentVolume = this.stateManager.state.volume;
        afterStates.newCurrentMuted = this.stateManager.state.muted;
        break;
    }

    this._fireEvent(options.verb, baseEventData, beforeStates, afterStates);
  }

  /**
   * Fires an analytics event
   * @param {string} verb The verb describing the event type
   * @param {Object} baseEventData The basic event data for every event
   * @param {Object} beforeStates Additional event data captured before the state change
   * @param {Object} afterStates Additional event data captured after the state change
   * @returns {void}
   */
  _fireEvent(verb, baseEventData, beforeStates, afterStates) {
    let eventData = {
      detail: Object.assign(
        baseEventData,
        { verb },
        beforeStates,
        afterStates),
    };

    let event = new CustomEvent('analytics', eventData);
    this.videoPlayer.dispatchEvent(event);
  }

  /**
   * Gets the minimum set of information for events
   * @returns {Object} Object containing the minimum set of information for events
   */
  _getBaseEventData() {
    return {
      currentTime: this.stateManager.state.position,
      currentSpeed: this.stateManager.state.playbackRate,
      currentQuality: this.stateManager.state.quality,
      currentSource: 'online',
      currentOrientation: (undefined || window.screen.msOrientation || (window.screen.orientation && window.screen.orientation.type)),
      currentSlide: this._getActiveSlide(),
      currentChapter: this._getActiveChapter(),
      currentFullscreen: this._getFullscreenMode(),
    };
  }

  /**
   * Gets the active chapter
   * @returns {Object} The active chapter object, undefined if there are no chapters
   */
  _getActiveChapter() {
    if (this.videoPlayer.configuration.chapters) {
      let chapters = this.videoPlayer.configuration.chapters;
      return chapters.slice()
                      .reverse()
                      .find(chapter => chapter.startPosition <= this.stateManager.state.position);
    } else
      return undefined;
  }

  /**
   * Gets the active slide
   * @returns {Object} The active slide object, undefined if there are none
   */
  _getActiveSlide() {
    if (this.videoPlayer.configuration.slides) {
      let slides = this.videoPlayer.configuration.slides;
      let slide = slides.slice()
                        .reverse()
                        .find(slide => slide.startPosition <= this.stateManager.state.position);
      if (slide)
        slide.slide_number = slides.slice().indexOf(slide); // eslint-disable-line camelcase
      return slide;
    } else
      return undefined;
  }

  /**
   * Gets the current fullscreen mode
   * @returns {boolean} Fullscreen state: TRUE if fullscreen is on, FALSE if not
   */
  _getFullscreenMode() {
    return this.stateManager.state.fullscreen === true;
  }

  /**
   * Handles event firing when tab/window is closed
   * @param {Object} event The unload event
   * @returns {void}
   */
  _handleWindowUnload(event) {
    event.preventDefault();
    let baseEventData = this._getBaseEventData();
    this._fireEvent(ANALYTICS_TOPICS.VIDEO_CLOSE, baseEventData);
  }

  /**
   * Handles event firing when device orientation changes
   * @returns {void}
   */
  _handleOrientationChange() {
    let baseEventData = this._getBaseEventData();
    let verb = ((window.screen.msOrientation || window.screen.orientation.type).includes('landscape') ? ANALYTICS_TOPICS.VIDEO_LANDSCAPE : ANALYTICS_TOPICS.VIDEO_PORTRAIT);
    this._fireEvent(verb, baseEventData);
  }

  /**
   * Returns the identifier for a cue.
   * @param {Object} cue The cue to identify
   * @returns {Object} Identifier text if available, Index of cue otherwise
   */
  _getCueIdentifier(cue) {
    if (cue && cue.id !== '')
      return cue.id;
    else
      return this.stateManager.state.activeCaptions.findIndex(cueCandidate => Object.is(cue, cueCandidate));
  }

  /**
   * Returns the active Cue.
   * @returns {Object} The active cue.
   */
  _getActiveCue() {
    if(this.stateManager.state.activeCaptions) {
      return this.stateManager.state.activeCaptions.slice()
                            .reverse()
                            .find(cue => cue.startTime <= this.stateManager.state.position);
    }
  }

  /**
   * Returns the current dual stream status.
   * @returns {String} Current dual stream status (dual_stream|^back_stream).
   */
  _getDualStreamStatus() {
    return (this.stateManager.state.fallbackStreamActive) ? 'fallback_stream' : 'dual_stream';
  }

  /**
   * Binds the orientation change event depending on the used browser.
   * @returns {void}
   */
  _bindOrientationChange() {
    // MacOS Safari doesn't support this feature
    if (window.screen.orientation && window.screen.orientation.onchange) { // Standard
      window.screen.orientation.onchange = this._handleOrientationChange.bind(this);
    } else if (window.orientationchange) { // IOS Safari
      window.orientationchange = this._handleOrientationChange.bind(this);
    } else if (window.screen.onmsorientationchange) { // IE and Edge
      window.onmsorientationchange = this._handleOrientationChange.bind(this);
    }
  }
}
