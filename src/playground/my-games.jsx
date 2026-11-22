// Sparkjam: the My games page. It needs no game engine, so it skips the GUI setup the other pages do.

import React from 'react';
import ReactDOM from 'react-dom';
import MyGames from '../components/sj-my-games/my-games.jsx';

ReactDOM.render(<MyGames />, document.getElementById('app'));
