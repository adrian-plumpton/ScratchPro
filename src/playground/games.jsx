// Sparkjam: the games page. It needs no game engine, so it skips the GUI setup the other pages do.

import React from 'react';
import ReactDOM from 'react-dom';
import Games from '../components/sj-games/games.jsx';

ReactDOM.render(<Games />, document.getElementById('app'));
