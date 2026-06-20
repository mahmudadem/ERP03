/**
 * PosHomePage — alias of PosTerminalPage so the menu /home route /pos
 * lands on the cashier screen directly. Both pages exist so future shifts
 * pages can deep-link to /pos/shift without losing the terminal.
 */
import PosTerminalPage from './PosTerminalPage';
export default PosTerminalPage;
