async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    let message = `Serverfel (${res.status})`;
    try {
      message = (await res.json()).error || message;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  list: () => request('/events'),
  create: (event) => request('/events', { method: 'POST', body: JSON.stringify(event) }),
  update: (id, event) => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(event) }),
  remove: (id) => request(`/events/${id}`, { method: 'DELETE' }),
};
