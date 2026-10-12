import './style.css';
import { startGame } from './game/game';
import { mountUi } from './ui/mount';

startGame(document.getElementById('game')!);
mountUi(document.getElementById('ui')!);
