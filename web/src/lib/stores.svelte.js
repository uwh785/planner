let _tasks = $state([]);
let _currentTask = $state(null);
let _loading = $state(false);
let _search = $state('');
let _dashboard = $state(null);

export const tasks = {
  get value() { return _tasks; },
  set value(v) { _tasks = v; }
};

export const currentTask = {
  get value() { return _currentTask; },
  set value(v) { _currentTask = v; }
};

export const loading = {
  get value() { return _loading; },
  set value(v) { _loading = v; }
};

export const search = {
  get value() { return _search; },
  set value(v) { _search = v; }
};

export const dashboard = {
  get value() { return _dashboard; },
  set value(v) { _dashboard = v; }
};
