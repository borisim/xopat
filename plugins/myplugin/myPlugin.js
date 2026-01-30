class MyPlugin extends XOpatPlugin {
	constructor(id) {
		super(id);
		this._starOverlays = [];
		this._updateHandler = null;
		this.star_selection = [];
		this.checkbox = [false, false, false, false]; // for two checkboxes
	}


	/*
	 * Ready to fire
	 */
	async pluginReady() {
		this.initHTML();
		console.log("MyPlugin: pluginReady");
		var dummy_coords = [[62539, 91681], [28847, 112342], [58435, 99116], [47395, 113231], [59422, 107623]]; // for testing
		dummy_coords.forEach(coord => {
			this.addStar(coord[0], coord[1]);
		});
	}

	handleUpdate(e) {
		// // Check if the inputs actually exist and have been rendered
		// if (!this.minInput?.element || !this.maxInput?.element) return;

		// // Use querySelector on the .element property
		// const minVal = this.minInput.element.querySelector('input').value;
		// const maxVal = this.maxInput.element.querySelector('input').value;

		console.log(e.target.value);
		console.log(e);
	}

	initHTML() {
		// 1. Create the inputs
		this.minInput = new UI.Input({
			legend: "From Layer: Min 0",
			type: "number",
			value: 1,
			min: 1,      // Prevents numbers below 1
			max: 100,    // Prevents numbers above 100
			step: 1,
			onChange: (e) => this.handleUpdate(e)
		});

		this.maxInput = new UI.Input({
			legend: "To Layer: Max 48",
			type: "number",
			value: 4,
			max: 48,	// Prevents numbers above 48
			onChange: (e) => this.handleUpdate(e)
		});

		// 2. Wrap them and the canvas in a Div for layout
		const dataGraphContainer = new UI.Div({
			base: "flex flex-col gap-2 border-t border-gray-700 mt-4 pt-4"
		},
			new UI.Div({ base: "flex gap-2" }, this.minInput, this.maxInput),
			new UI.RawHtml({
				html: `<canvas id="pointCloud" width="400" height="300" style="background:black;"></canvas>`
			})
		);


		// var box_list = [];
		// for (let i = 0; i < 4; i++) {
		// 	box_list.push(
		// 		new Checkbox({
		// 			id: "myCheckbox" + i,
		// 			label: "layer " + (i + 1),
		// 			checked: true,
		// 			onchange: () => this.checkbox[i] = !this.checkbox[i]
		// 		})
		// 	);
		// }

		USER_INTERFACE.addHtml(
			new UI.FloatingWindow(
				{
					id: "test-menu",
					title: "Comments",
					closable: false,
				}, new Button({
					id: "myButton",
					size: Button.SIZE.LARGE,
					outline: Button.OUTLINE.ENABLE,
					onClick: () => {
						console.log("MyPlugin: current star selection:", this.star_selection);
						console.log("MyPlugin: checkbox states:", this.checkbox);
						setTimeout(() => {
							let data = APPLICATION_CONTEXT.config.data;
							data.push("053348649635572b823324e0b41f141a")
							alert("Stars sent!");
							APPLICATION_CONTEXT.openViewerWith(
								data,
								undefined,
								[
									{
										"name": "A visualization setup 1",
										"lossless": true,
										"protocol": "`${path}/v3/slides/info?slide_id=${data[0]}`",
										"shaders": {
											"shader_id_1": {
												"name": "Advanced visualization layer",
												"type": "heatmap",
												"fixed": false,
												"visible": 1,
												"dataReferences": [data.length - 1],
												"params": {}
											},
										}
									}
								]
							)
						}, 100);
					},
				},
					"Send staaars!⭐"),
				// ...box_list,
				dataGraphContainer,
			)
		);

		// 3. THE CANVAS HTML
		const canvasHtml = `<canvas id="pointCloud" width="400" height="400" style="background:#f0f0f0;"></canvas>`;
		USER_INTERFACE.addHtml(
			new UI.FloatingWindow({
				id: "graph-window",
				title: "WSI Data Graph",
			}, canvasHtml)
		);
		// 4. THE CLICKABLE LOGIC (PASTE THIS AT THE VERY BOTTOM OF initHTML)
		setTimeout(() => {
			const canvas = document.getElementById('pointCloud');
			if (!canvas) return;
			const ctx = canvas.getContext('2d');

			// 1. Generate Dummy Data
			const generateData = (count) => {
				let points = [];
				for (let i = 0; i < count; i++) {
					points.push({
						x: Math.random() * canvas.width,
						y: Math.random() * canvas.height
					});
				}
				return points;
			};

			// 2. Simple Clustering Logic (K-Means style grouping)
			const clusterPoints = (points, k) => {
				// Create random starting centroids
				let centroids = points.slice(0, k);
				let clusters = centroids.map((c, i) => ({ id: `cluster_${i}`, points: [], color: `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.3)` }));

				points.forEach(p => {
					// Find closest centroid
					let distances = centroids.map(c => Math.sqrt((p.x - c.x) ** 2 + (p.y - c.y) ** 2));
					let closestIndex = distances.indexOf(Math.min(...distances));
					clusters[closestIndex].points.push(p);
				});
				return clusters;
			};

			// const rawPoints = generateData(100);
			// 1. Function to generate a cluster of points around a specific center
			const generateCluster = (centerX, centerY, spread, count, id) => {
				let points = [];
				for (let i = 0; i < count; i++) {
					points.push({
						// Center point + random offset within the 'spread' range
						x: centerX + (Math.random() - 0.5) * spread,
						y: centerY + (Math.random() - 0.5) * spread,
						clusterId: id
					});
				}
				return points;
			};

			// 2. Create 3 visually distinct, correlated arrays of points
			const cluster1 = generateCluster(100, 100, 80, 40, "Alpha");  // Top Left
			const cluster2 = generateCluster(300, 150, 90, 40, "Beta");   // Middle Right
			const cluster3 = generateCluster(150, 300, 100, 40, "Gamma"); // Bottom Center

			// Combine them into one array for your clustering logic
			const rawPoints = [...cluster1, ...cluster2, ...cluster3];
			this.clusters = clusterPoints(rawPoints, 5);

			const draw = () => {
				ctx.clearRect(0, 0, canvas.width, canvas.height);

				// 1. Draw the "Background" Regions (Voronoi-style)
				// We check every 5th pixel to save performance
				const cellSize = 5;
				for (let x = 0; x < canvas.width; x += cellSize) {
					for (let y = 0; y < canvas.height; y += cellSize) {
						let closestCluster = null;
						let minDist = Infinity;

						this.clusters.forEach(cluster => {
							// Find distance to the cluster's center (mean of its points)
							const center = cluster.center;
							const dist = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
							if (dist < minDist) {
								minDist = dist;
								closestCluster = cluster;
							}
						});

						if (closestCluster) {
							ctx.fillStyle = closestCluster.color;
							ctx.fillRect(x, y, cellSize, cellSize);
						}
					}
				}

				// 2. Draw the Points on top
				this.clusters.forEach(cluster => {
					ctx.fillStyle = "black";
					cluster.points.forEach(p => {
						ctx.beginPath();
						ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
						ctx.fill();
					});
				});
			};

			// Update Cluster Centers before drawing
			this.clusters.forEach(cluster => {
				const xs = cluster.points.map(p => p.x);
				const ys = cluster.points.map(p => p.y);
				cluster.center = {
					x: xs.reduce((a, b) => a + b, 0) / xs.length,
					y: ys.reduce((a, b) => a + b, 0) / ys.length
				};
			});

			draw();

			// 3. Click Logic (Finds the closest cluster center - no overlaps!)
			canvas.onclick = (event) => {
				const rect = canvas.getBoundingClientRect();
				const x = event.clientX - rect.left;
				const y = event.clientY - rect.top;

				let selectedCluster = null;
				let minDist = Infinity;

				this.clusters.forEach(cluster => {
					const dist = Math.sqrt((x - cluster.center.x) ** 2 + (y - cluster.center.y) ** 2);
					if (dist < minDist) {
						minDist = dist;
						selectedCluster = cluster;
					}
				});

				console.log("Clicked Cluster ID:", selectedCluster.id);
				alert("Selected: " + selectedCluster.id);
			};
		}, 300);
	}

	/**
	 * Add a star overlay at image pixel coordinates (x, y).
	 * @param {number} x Image X coordinate in pixels
	 * @param {number} y Image Y coordinate in pixels
	 * @param {object} [opts] Optional {sizePx, id}
	 */
	addStar(x, y, opts = {}) {
		if (typeof VIEWER === 'undefined' || !VIEWER) {
			console.warn('MyPlugin: VIEWER not available');
			return;
		}

		// determine image dimensions
		let imgW = 0, imgH = 0;
		try {
			const item = VIEWER.world.getItemAt(0);
			if (item && item.getContentSize) {
				const p = item.getContentSize();
				imgW = p.x; imgH = p.y;
			}
		} catch (e) { }
		if (!imgW && VIEWER.source && VIEWER.source.dimensions) {
			imgW = VIEWER.source.dimensions.x;
			imgH = VIEWER.source.dimensions.y;
		}
		if (!imgW || !imgH) {
			console.warn('MyPlugin: could not determine image dimensions');
			return;
		}

		const sizePx = opts.sizePx || 32;
		const nx = x / imgW;
		const ny = y / imgH;

		// create star element (inline SVG)
		const elt = document.createElement('div');
		elt.className = 'myplugin-star-overlay';
		elt.style.pointerEvents = 'auto';
		// fixed screen pixel size (not affected by viewer zoom)
		elt.style.width = Math.round(sizePx) + 'px';
		elt.style.height = Math.round(sizePx) + 'px';
		elt.style.display = 'flex';
		elt.style.alignItems = 'center';
		elt.style.justifyContent = 'center';
		elt.style.transform = 'translate(-50%, -50%)';
		elt.style.position = 'absolute';
		elt.innerHTML = `
			<svg viewBox="0 0 24 24" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
			  <path fill="#000000" stroke="#000000" stroke-width="0.8" d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.788 1.402 8.174L12 18.896 4.664 23.172l1.402-8.174L.132 9.21l8.2-1.192z"/>
			</svg>`;

		// make star clickable without letting clicks fall through to the viewer
		elt.setAttribute('role', 'button');
		elt.tabIndex = 0;
		elt.addEventListener('click', (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			console.log('MyPlugin: star clicked at image coords', x, y);

			// if start selected, add to selection list, if unselected, remove from selection list

			if (elt.querySelector('path').getAttribute('fill') === '#ff0') {
				elt.querySelector('path').setAttribute('fill', '#000');
				const index = this.star_selection.findIndex(coord => coord[0] === x && coord[1] === y);
				if (index !== -1) {
					this.star_selection.splice(index, 1);
				}
			} else {
				elt.querySelector('path').setAttribute('fill', '#ff0');
				this.star_selection.push([x, y]);
			}
			// console.log('MyPlugin: current star selection:', this.star_selection);
		});

		// append to viewer container and remember image coords for updates
		try {
			const container = (VIEWER && (VIEWER.container || VIEWER.element)) || document.body;
			container.appendChild(elt);
		} catch (e) { }

		this._starOverlays.push({ el: elt, x: x, y: y, sizePx: sizePx });

		// register update handler once
		if (!this._updateHandler && VIEWER && VIEWER.addHandler) {
			this._updateHandler = () => {
				try {
					const item = VIEWER.world.getItemAt(0);
					if (!item) return;
					this._starOverlays.forEach(rec => {
						try {
							const vp = (item.imageToViewportCoordinates)
								? item.imageToViewportCoordinates(rec.x, rec.y, true)
								: VIEWER.viewport.imageToViewportCoordinates(rec.x, rec.y, true);
							const px = VIEWER.viewport.pixelFromPoint(vp, true);
							rec.el.style.left = Math.round(px.x) + 'px';
							rec.el.style.top = Math.round(px.y) + 'px';
						} catch (e) { }
					});
				} catch (e) { }
			};
			VIEWER.addHandler('animation', this._updateHandler);
			VIEWER.addHandler('open', this._updateHandler);
			// apply initial position immediately
			this._updateHandler();
		}

		return elt;
	}

	/** Remove all stars added by this plugin */
	clearStars() {
		if (!this._starOverlays.length) return;
		this._starOverlays.forEach(rec => {
			try { if (rec.el && rec.el.parentNode) rec.el.parentNode.removeChild(rec.el); } catch (e) { }
		});
		this._starOverlays = [];
		// unregister update handler when no overlays left
		if (this._updateHandler && VIEWER && VIEWER.removeHandler) {
			try { VIEWER.removeHandler('animation', this._updateHandler); } catch (e) { }
			try { VIEWER.removeHandler('open', this._updateHandler); } catch (e) { }
			this._updateHandler = null;
		}
	}
}

addPlugin("my_plugin", MyPlugin);
