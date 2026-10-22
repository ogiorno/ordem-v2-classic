/**
 * Fila por chave (normalmente o id da ficha): as tarefas da mesma chave rodam uma de cada vez, na ordem em que
 * chegaram; chaves diferentes não esperam umas pelas outras. Uma tarefa que falha não trava as seguintes.
 */
export function createTaskQueue() {
	const tails = new Map();
	return function run(key, task) {
		const previous = tails.get(key) ?? Promise.resolve();
		const result = previous.catch(() => {}).then(task);
		const tail = result.catch(() => {});
		tails.set(key, tail);
		tail.then(() => tails.get(key) === tail && tails.delete(key));
		return result;
	};
}
