import { mount } from "svelte";
import App from "./App.svelte";
import "./style.css";
import "./expenses.css";
import { initPwa } from "./lib/pwa.svelte";

initPwa();
mount(App, { target: document.getElementById("app")! });
