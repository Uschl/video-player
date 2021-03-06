import {PLAY_STATES, SYNC_INTERVAL, SYNC_DIFF_THRESHOLD} from '../constants.js';
export class SynchronizationManager {
  /**
   * Initializes a new SynchronizationManager instance.
   * @param {StateManager} stateManager  The StateManager of the video player instance.
   * @return {SynchronizationManager}  The new SynchronizationManager instance.
   */
  constructor(stateManager) {
    this._stateManager = stateManager;
    this._videos = [];
    this._videosWaiting = new Set();
    this._videoBufferPositions = new Map();
    this._readyCallbacks = [];

    // Needed in order to overcome removeEventListener
    this._videoWaiting = this._videoWaiting.bind(this);
    this._videoSeeking = this._videoSeeking.bind(this);
    this._videoReady = this._videoReady.bind(this);
    this._videoProgress = this._videoProgress.bind(this);
    this._videoTimeUpdate = this._videoTimeUpdate.bind(this);
    this._videoEnded = this._videoEnded.bind(this);
    this._videoDurationChanged = this._videoDurationChanged.bind(this);

    this._syncVideos();
  }

  /**
   * Registers a new video element to enable synchronization of this video.
   * @param  {HTMLElement} video The video element that should be registered.
   * @return {void}
   */
  registerVideo(video) {
    this._videos.push(video);

    video.addEventListener('waiting', this._videoWaiting);
    video.addEventListener('seeking', this._videoSeeking);
    video.addEventListener('canplay', this._videoReady);
    video.addEventListener('canplaythrough', this._videoReady);
    video.addEventListener('seeked', this._videoReady);
    video.addEventListener('progress', this._videoProgress);
    video.addEventListener('ended', this._videoEnded);
    video.addEventListener('timeupdate', this._videoTimeUpdate);
    video.addEventListener('durationchange', this._videoDurationChanged);
  }

  /**
   * Unregisters a new video element to stop synchronization of this video.
   * @param  {HTMLElement} video The video element that should be unregistered.
   * @return {void}
   */
  unregisterVideo(video) {
    this._videos = this._videos.filter(x => x !== video);
    this._videosWaiting.delete(video);

    video.removeEventListener('waiting', this._videoWaiting);
    video.removeEventListener('seeking', this._videoSeeking);
    video.removeEventListener('canplay', this._videoReady);
    video.removeEventListener('canplaythrough', this._videoReady);
    video.removeEventListener('seeked', this._videoReady);
    video.removeEventListener('progress', this._videoProgress);
    video.removeEventListener('ended', this._videoEnded);
    video.removeEventListener('timeupdate', this._videoTimeUpdate);
    video.removeEventListener('durationchange', this._videoDurationChanged);
  }

  /**
   * Registers a new callback, which is invoked when all registered videos are ready.
   * @param  {Function} callback The callback, which should be registered.
   * @param  {Boolean} [once=false] A Boolean indicating that the callback should be invoked at most once after being added.
   * @return {void}
   */
  onVideosReady(callback, once = false) {
    this._readyCallbacks.push({callback, once});
  }

  /**
   * Gets a value determining whether a video is the synchronization
   * master video.
   * @param  {HTMLElement} video The video element to be checked.
   * @return {Boolean} The value.
   */
  isMaster(video) {
    return this._videos.indexOf(video) === 0;
  }

  /**
   * Is called on every time update of any of the registered video elements.
   * Propagates position of master stream to slave videos and state manager.
   * @param  {EventArgs} e The event that was triggered.
   * @return {void}
   */
  _videoTimeUpdate(e) {
    let video = e.target;
    if(this.isMaster(video) && !this._anyWaiting()) {
      // Stay within trimmed range, if set
      if(this._stateManager.state.trimStart && video.currentTime < this._stateManager.state.trimStart) {
        this._stateManager.setPosition(this._stateManager.state.trimStart, false);
      } else if(this._stateManager.state.trimEnd && video.currentTime > this._stateManager.state.trimEnd) {
        this._stateManager.setPosition(this._stateManager.state.trimEnd, false);
      } else {
        this._stateManager.setPosition(video.currentTime, false);
      }
    }
  }

  /**
   * Is called when a video playback of an registered video element has ended.
   * @param  {EventArgs} e The event that was triggered.
   * @return {void}
   */
  _videoEnded(e) {
    // Explicitly propagate end of video (needed for HLS.js)
    let video = e.target;
    if(this.isMaster(video) && !this._anyWaiting()) {
      this._stateManager.setPlayState(PLAY_STATES.FINISHED);
    }
  }

  /**
   * Is called when the metadata of a registered video element were loaded.
   * Extracts duration of the video after metadata have been loaded.
   * @param  {EventArgs} e The event that was triggered.
   * @return {void}
   */
  _videoDurationChanged(e) {
    let video = e.target;
    if(this.isMaster(video)) {
      this._stateManager.setDuration(video.duration);
    }
  }

  /**
   * Synchronizes the positions of the slave videos to the master video
   * after fixed time intervals.
   * @return {void}
   */
  _syncVideos() {
    if(!this._anyWaiting() && !this._stateManager.state.live) {
      let master = this._videos[0];
      if(this._stateManager.state.playState === PLAY_STATES.PAUSED) {
        // The positions can be set instantly if playback is paused
        this._videos.filter(video => video.currentTime !== master.currentTime)
                    .forEach(video => video.currentTime = master.currentTime);
      } else {
        // The state is set to waiting before setting the positions if videoa are playing
        this._videos.filter(video => Math.abs(video.currentTime - master.currentTime) > SYNC_DIFF_THRESHOLD)
                    .forEach(video => {
                      this.setWaiting(video);
                      video.currentTime = master.currentTime;
                    });
      }
    }

    setTimeout(() => this._syncVideos(), SYNC_INTERVAL * 1000);
  }

  /**
   * Gets a value determining whether there are videos, which currently
   * cannot play and need to buffer before continuing playback.
   * @return {Boolean} The value.
   */
  _anyWaiting() {
    return this._videosWaiting.size > 0;
  }

  /**
   * Is called everytime a registered video element is waiting for new data.
   * @param  {EventArgs} e The event that was triggered.
   * @return {void}
   */
  _videoWaiting(e) {
    this.setWaiting(e.target);
  }

  /**
   * Is called everytime a registered video is seeking.
   * @param  {EventArgs} e The event that was triggered.
   * @return {void}
   */
  _videoSeeking(e) {
    // Check if requested timestamp is buffered
    let video = e.target;
    let seekTime = e.target.currentTime;
    for(let i = 0; i < video.buffered.length; i++) {
      if(seekTime >= video.buffered.start(i) && seekTime < video.buffered.end(i))
        return;
    }

    // If timestamp is not buffered, set video to waiting
    this.setWaiting(video);
  }

  /**
   * Sets the state of a video to 'waiting'.
   * @param  {HTMLElement} video The video element
   * @return {void}.
   */
  setWaiting(video) {
    if(!this._anyWaiting()) {
      this._backupPlayState();
    }
    this._videosWaiting.add(video);

    // If video has already ended, WAITING state is not set
    if(this._stateManager.state.playState !== PLAY_STATES.FINISHED) {
      this._stateManager.setPlayState(PLAY_STATES.WAITING);
    }
  }

  /**
   * Is called everytime a registered video element is ready for playback.
   * @param  {EventArgs} e The event that was triggered.
   * @return {void}
   */
  _videoReady(e) {
    if(this._videosWaiting.delete(e.target) && !this._anyWaiting()) {
      this._restorePlayState();

      // Invoke registered callbacks
      this._readyCallbacks.forEach(entry => entry.callback());
      this._readyCallbacks = this._readyCallbacks.filter(entry => !entry.once);
    }
  }

  /**
   * Is called everytime a registered video element downloads new data.
   * Propagates buffer position to state manager.
   * @param  {EventArgs} e The event that was triggered.
   * @return {void}
   */
  _videoProgress(e) {
    let video = e.target;
    if(video.buffered.length > 0) {
      // Get buffer position of the current segment of the video
      for (let i = video.buffered.length - 1; i >=0; i--) {
        if (video.buffered.start(i) <= video.currentTime) {
          let currentBuffer = video.buffered.end(i);
          this._videoBufferPositions.set(video, currentBuffer);
          break;
        }
      }

      // Update global buffer position with minimum buffer position of all
      // videos, which is the common buffer
      if(this._videoBufferPositions.size > 0) {
        let globalBuffer = Math.min(...Array.from(this._videoBufferPositions.values()));
        this._stateManager.setBufferPosition(globalBuffer);
      }
    }
  }

  /**
   * Stores the current play state as backup for later use.
   * @return {void}
   */
  _backupPlayState() {
    let playState = this._stateManager.state.playState;
    if(playState !== PLAY_STATES.WAITING) {
      this.backupPlayState = playState;
    }
  }

  /**
   * Restores the backup play state, if present.
   * @return {void}
   */
  _restorePlayState() {
    if(this.backupPlayState) {
      if(this._stateManager.state.playState === PLAY_STATES.WAITING) {
        this._stateManager.setPlayState(this.backupPlayState, false);
      }
      this.backupPlayState = null;
    }
  }
}
