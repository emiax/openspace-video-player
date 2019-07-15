import React, { Component } from 'react';
import './App.css';

import openspaceApi from 'openspace-api-js';

let media = {};
let error = undefined;

try {
  const urlParams = new URLSearchParams(window.location.search);
  const mediaString = urlParams.get('media');
  if (!mediaString) {
    throw 'Missing media.';
  }
  const media = JSON.parse(mediaString);
  console.log(media);
} catch(e) {
  error = e;
}

function listenToTime(api, cb) {
  const timeTopic = api.startTopic('time', {
    event: 'start_subscription',
  });

  (async function fn() {
    const data = await timeTopic.iterator().next();
    cb(data.value);
    fn();
  })();
}

const secondsOffTolerancePlaying = 1;
const secondsOffTolerancePaused = 1/20;

class App extends Component {
  constructor() {
    super();
    this.update = this.update.bind(this);
    this.mediaRef = React.createRef();

    this.state = {
      mediaSource: undefined
    };

    const api = openspaceApi();
    api.onConnect(() => listenToTime(api, this.update));
    api.connect();
  }

  update(data) {
    if (data.targetDeltaTime) {
      this.setState({
        targetDeltaTime: data.targetDeltaTime
      });
    }
    if (data.isPaused !== undefined) {
      this.setState({
        isPaused: data.isPaused
      });
    }

    if (data.time) {
      const time = data.time;
      const simulationTime = new Date(time);
      let msInClip = Infinity;
      let foundMedia = undefined;

      Object.keys(media).forEach((startTime) => {
        const diff = simulationTime.getTime() - (new Date(startTime)).getTime();
        if (diff > 0 && diff < msInClip) {
          msInClip = diff;
          foundMedia = media[startTime];
        }
      });

      if (foundMedia) {
        this.setState({
          mediaSource: foundMedia,
          targetTime: msInClip / 1000
        });
      } else {
        this.setState({
          mediaSource: null,
          targetTime: 0
        })
      }
    }
  }

  async setPlaybackState(time, rate) {
    const element = this.mediaRef.current;

    if (!element) {
      return;
    }

    if (time > element.duration) {
      await element.pause();
      element.currentTime = 0;
      element.style.opacity = 0;
      return;
    } else {
      element.style.opacity = 1;
    }

    // First, let's make sure the currentTime is within tolerances.
    // Use different tolerances depending on paused or playing state.
    const diff = Math.abs(time - element.currentTime);
    if (rate === 0) {
      if (diff > secondsOffTolerancePaused) {
        console.log('jump while paused. Diff was: ' + diff + 's');
        element.currentTime = time;
      }
    } else {
      if (diff > secondsOffTolerancePlaying) {
        console.log('jump while playing. Diff was: ' + diff + 's');
        element.currentTime = time;
      }
    }

    // Second, let's play the video at the same speed as OpenSpace's simulation speed.
    // This may fail due to browser playback rate limitations,
    // so in that case we fall back to setting the time and pausing.
    try {
      if (rate === 0) {
        // Simulation is paused:
        if (element.playbackRate !== 1) {
          element.playbackRate = 1;
        }
        if (!element.paused) {
          console.log('pausing');
          await element.pause();
        }
      } else {
        // Simulation is playing:
        if (element.playbackRate !== rate) {
          element.playbackRate = rate;
        }
        if (element.paused) {
          console.log('playing');
          await element.play();
        }
      }
    } catch (e) {
      // Fallback on setting time and pausing:
      if (element.currentTime !== time) {
        element.currentTime = time;
        console.log('jump (not keeping up)');
      }
      if (element.playbackRate !== 1) {
        console.log('playback rate fallback (not keeping up)');
        element.playbackRate = 1;
      }
      if (!element.paused) {
        console.log('pausing (not keeping up)');
        await element.pause();
      }
    }
  }

  render() {
    if (error) {
      const usageExample = '?media={"1968-12-24T16:37:27":"earthrise.wav","1969-07-20T20:03:23":"apollo11-landing.webm"}';
      console.error(error);
      return <div>
        <p>Error: {error.toString()}</p>
        <p>Usage: Specify the media files to use as a query parameter. Example: {usageExample}</p>
      </div>;
    }

    const source = this.state.mediaSource;
    if (!source) {
      return null;
    }

    const playbackRate = this.state.isPaused ? 0 : this.state.targetDeltaTime;
    const targetTime = this.state.targetTime;

    const filename = source.split('.');
    const extension = filename[1] || '';

    let mimeType = undefined;
    let MediaType = undefined;

    switch (extension) {
      case 'webm':
        MediaType = 'video';
        mimeType = 'video/webm';
      break;
      case 'wav':
        MediaType = 'audio';
        mimeType = 'audio/wav';
      break;
      default:
        return null;
    }

    if (!mimeType || !MediaType) {
      return null;
    }

    setTimeout(() => this.setPlaybackState(targetTime, playbackRate), 0);

    return (
      <MediaType className="fullscreen" ref={this.mediaRef}>
        {<source src={this.state.mediaSource} type={mimeType}/>}
      </MediaType>
    );
  }
}

export default App;
