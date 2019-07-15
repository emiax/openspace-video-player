import React, { Component } from 'react';
import './App.css';

import openspaceApi from 'openspace-api-js';

// Apollo 11 Landing from:
// https://www.youtube.com/watch?v=RONIax0_1ec
// This file is not in the repository.
const videos = {
  "1969-07-20T20:03:23": "apollo11-landing.webm"
};

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


const secondsOffTolerance = 1;

class App extends Component {
  constructor() {
    super();
    this.update = this.update.bind(this);

    this.videoRef = React.createRef();

    this.state = {
      videoSource: undefined
    }

    const api = openspaceApi();
    api.onConnect(() => listenToTime(api, this.update));
    api.connect();
  }

  update(data) {
    if (data.targetDeltaTime) {
      this.setState({
        targetDeltaTime: data.targetDeltaTime
      })
    }
    if (data.isPaused !== undefined) {
      this.setState({
        isPaused: data.isPaused
      })
    }

    if (data.time) {
      const time = data.time;
      const simulationTime = new Date(time);
      let msInVideo = Infinity;
      let foundVideo = undefined;

      Object.keys(videos).forEach((startTime) => {
        const diff = simulationTime.getTime() - (new Date(startTime)).getTime();
        if (diff > 0 && diff < msInVideo) {
          msInVideo = diff;
          foundVideo = videos[startTime];
        }
      });

      if (foundVideo) {
        this.setState({
          videoSource: foundVideo,
          targetTime: msInVideo / 1000
        });
      }
    }
  }

  render() {
    const video = this.videoRef.current;
    if (video) {

      const playbackRate = this.state.isPaused ? 0 : this.state.targetDeltaTime;

      if (this.state.videoSource &&
          (playbackRate === 0 ||
           Math.abs(this.state.targetTime - video.currentTime) > secondsOffTolerance))
      {        
        video.currentTime = this.state.targetTime;  
      }

      try {
        video.playbackRate = playbackRate;
        video.play();
      } catch (e) {
        video.playbackRate = 0;
        video.pause();
      }
    }

    return (
      <video ref={this.videoRef}>
        {this.state.videoSource && <source src={this.state.videoSource} type="video/webm"/>}
      </video>
    );
  }
}

export default App;
