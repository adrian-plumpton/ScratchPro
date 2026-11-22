// Sparkjam: the landing page. It needs no game engine, so it skips the GUI setup the other pages do.

import React from 'react';
import ReactDOM from 'react-dom';
import Landing from '../components/sj-landing/landing.jsx';

ReactDOM.render(<Landing />, document.getElementById('app'));
