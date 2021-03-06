import { ANALYTICS_TOPICS } from '../constants.js';
import { IocRequesterMixin } from '../mixins/ioc-requester.js';
import { BindingHelpersMixin } from '../mixins/binding-helpers.js';
import '../styling/lists--style-module.js';
import 'fontawesome-icon';
import { PolymerElement, html } from '@polymer/polymer';

class InteractiveTranscript extends BindingHelpersMixin(IocRequesterMixin(PolymerElement)) {
  static get template() {
    return html`
      <style type="text/css" include="lists--style-module">

        #container__interactive_transcript {
          overflow: hidden;
          color: black;
          height: 200px;
          width: 100%;
          border-top: 1px solid grey;
        }

        #container__interactive_transcript .list {
          perspective: 300px;
          perspective-origin: 50% 50%;
        }

        #container__interactive_transcript .list_item {
          display: flex;
          padding: 15px 5px 15px 20px;
          background-color: #eee;
          font-size: 18px;
          overflow: hidden;
          @apply --transition-duration-600;
        }
        #container__interactive_transcript .list_item .list_item__link {
          color: black;
        }
        #container__interactive_transcript .list_item .list_item__caret {
          margin-right: 4px;
        }
        #container__interactive_transcript .list_item .list_item__prefix {
          white-space: nowrap;
          margin-right: 15px;
        }

        #container__interactive_transcript .list_item.-active,
        #container__interactive_transcript .list_item:nth-child(odd).-active {
          background-color: #bbb;
        }

        #container__interactive_transcript .list_item:nth-child(odd) {
          background-color: #fff;
        }

        #container__interactive_transcript .list_item:hover,
        #container__interactive_transcript .list_item.-active:hover {
          @apply --set-accent-color-background;
          @apply --set-font-color-on-accent-color;
          @apply --transition-duration-200;
          cursor: pointer;
        }
      </style>

      <div id="container__interactive_transcript" class="container__list">
        <ul class="list">
            <template is="dom-repeat" items="[[_visibleCaptions]]">
              <li class$="list_item [[ifEqualsThen(item, _activeCue, '-active')]]" on-click="_handleClick">
                <fontawesome-icon class="list_item__caret" prefix="fas" name="caret-right" style$="visibility: [[ifEqualsThenElse(item, _activeCue, 'visible', 'hidden')]]" fixed-width></fontawesome-icon>
                <span class$="list_item__prefix list_item__link [[ifEqualsThen(item, _activeCue, 'active')]]">
                  [[_formatSeconds(item.startTime, state.duration, state.trimStart, state.trimEnd)]] -
                  [[_formatSeconds(item.endTime, state.duration, state.trimStart, state.trimEnd)]]:
                </span>
                <span class="list_item__link">
                  [[item.text]]
                </span>
              </li>
            </template>
        </ul>
      </div>
    `;
  }

  static get is() { return 'interactive-transcript'; }

  static get properties() {
    return {
      state: Object,
      _analyticsManager: {
        type: Object,
        inject: 'AnalyticsManager',
      },
      _stateManager: {
        type: Object,
        inject: 'StateManager',
      },
      _visibleCaptions: {
        type: Array,
        computed: '_getVisibleCaptions(state.activeCaptions, state.trimStart, state.trimEnd)',
      },
      _activeCue: {
        type: Object,
        computed: '_getActiveCue(_visibleCaptions, state.position)',
      },
    };
  }

  static get observers() {
    return [
      '_activeCueChanged(_activeCue, state.showInteractiveTranscript)', // Observe showInteractiveTranscript to scroll to current element when element is shown
    ];
  }

  _getActiveCue(captions, position) {
    if(captions) {
      return captions.slice()
                     .reverse()
                     .find(cue => cue.startTime <= position &&
                                  cue.endTime > position);
    }
  }

  _getVisibleCaptions(captions, trimStart, trimEnd) {
    if(captions) {
      return captions.filter(cue => (!trimStart || cue.endTime > trimStart) &&
                                    (!trimEnd || cue.startTime < trimEnd));
    }
  }

  _activeCueChanged() {
    let activeElement = this.$.container__interactive_transcript.getElementsByClassName('-active')[0];
    if(activeElement) {
      activeElement.parentNode.scrollTop = activeElement.offsetTop;
    }
  }

  _formatSeconds(seconds, duration, trimStart, trimEnd) {
    seconds = Math.min(Math.max(0, seconds - trimStart), trimEnd);
    return this.secondsToHms(seconds, duration);
  }

  _handleClick(e) {
    this._analyticsManager.changeState('setPosition', [e.model.item.startTime], {verb: ANALYTICS_TOPICS.VIDEO_TRANSCRIPT_SEEK});
  }
}

window.customElements.define(InteractiveTranscript.is, InteractiveTranscript);
