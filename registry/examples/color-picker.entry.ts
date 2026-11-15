import { Runtime } from 'foldkit';
import { Model, init, update, view, subscriptions } from './main';
import './fluid/tailwind.css';

const container = document.getElementById('app');
if (!container) throw new Error('Missing application host');
Runtime.run(Runtime.makeApplication({ Model, container, init, update, view, subscriptions }));
