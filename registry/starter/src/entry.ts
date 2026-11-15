import { Runtime } from 'foldkit';
import { Model, init, update, view } from './main';
import './fluid/tailwind.css';
import './app.css';

const container = document.getElementById('app');
if (!container) throw new Error('Missing application host');
Runtime.run(Runtime.makeApplication({ Model, container, init, update, view }));
