class MyPlugin extends XOpatPlugin {
	constructor(id) {
		super(id);
		this._starOverlays = [];
		this._updateHandler = null;
		this.star_selection = [];
	}


	/*
	 * Ready to fire
	 */
	async pluginReady() {
		this.initHTML();
		console.log("MyPlugin: pluginReady");
		// var dummy_coords = [[62539, 91681], [28847, 112342], [58435, 99116], [47395, 113231], [59422, 107623]]; // for testing
		// dummy_coords.forEach(coord => {
		// 	this.addStar(coord[0], coord[1]);
		// });
		// The slide path must be URL-encoded for the query string

		// setTimeout(async () => {
		// 	const slidePath = "/mnt/data/MOU/prostate/tile_level_annotations/P-2016_0383-12-0.mrxs";
		// 	const url = `http://127.0.0.1:9999/get_spatial_registers?slide_path=${encodeURIComponent(slidePath)}`;

		// 	console.log("MyPlugin: Requesting data from Ray...");

		// 	try {
		// 		const response = await fetch(url, {
		// 			method: 'POST',
		// 			mode: 'cors',
		// 			// Setting credentials to 'omit' sometimes helps unstable tunnels
		// 			credentials: 'omit'
		// 		});

		// 		if (!response.ok) throw new Error(`Ray error: ${response.status}`);

		// 		const data = await response.json();
		// 		const registers = data.spatial_registers;

		// 		// BATCH DRAWING: Don't draw one by one immediately
		// 		// Just print a count first to ensure data arrived
		// 		console.log(`MyPlugin: Received ${registers.length} points.`);

		// 		registers.forEach(coord => {
		// 			this.addStar(coord[0], coord[1]);
		// 		});

		// 	} catch (e) {
		// 		console.error("Connection to Ray failed:", e);
		// 	}
		// }, 500); // 500ms delay

		try {
			// Use './' to fetch relative to the current script's location
			const response = await fetch("./plugins/myplugin/json_data.json");

			if (!response.ok) {
				// Plan B: Try the root-relative path if the above fails
				console.warn("Relative path failed, trying root-relative...");
				const altResponse = await fetch("plugins/myplugin/json_data.json");
				if (!altResponse.ok) throw new Error("File not found in any expected location.");
				var data = await altResponse.json();
			} else {
				var data = await response.json();
			}

			this.data = data;
			if (this.data && this.data.embeddings) {
				console.log("MyPlugin: Data loaded, starting clustering...");

				this.points = this.processEmbeddings(this.data.embeddings, 7);

				// console.log("%c Starting Elbow Method Analysis...", "color: #A78BFA; font-weight: bold;");
				// for (let k = 2; k <= 10; k++) {
				// 	// Run the processing for each k
				// 	// The console logs inside processEmbeddings will print the MSE for each iteration
				// 	this.processEmbeddings(this.data.embeddings, k);
				// }

				this.initGraph();
				console.log("Graph successfully initialized with PCA data.");
			}

			const registers = data.spatial_registers;
			console.log(`MyPlugin: Received ${registers.length} points.`);
			if (registers && Array.isArray(registers)) {
				registers.forEach(coord => {
					this.addStar(coord[0], coord[1]);
				});
			}
		} catch (error) {
			console.error("MyPlugin: Error loading JSON:", error);
		}
	}



	processEmbeddings(embeddings, k = 4) {
		const MASTER_PALETTE = [
			{ main: '#60A5FA', bg: '#DBEAFE' },
			{ main: '#34D399', bg: '#D1FAE5' },
			{ main: '#FBBF24', bg: '#FEF3C7' },
			{ main: '#F87171', bg: '#FEE2E2' },
			{ main: '#A78BFA', bg: '#EDE9FE' },
			{ main: '#F472B6', bg: '#FCE7F3' },
			{ main: '#FB923C', bg: '#FFEDD5' }
		];

		try {
			const pca = new ML.PCA(embeddings);
			const projected = pca.predict(embeddings, { nComponents: 2 }).data;

			const result = ML.KMeans.kmeans(embeddings, k);
			const clusters = result.clusters;

			// --- GROUP INDICES BY CLUSTER ---
			// This will hold { 0: [idx, idx...], 1: [idx, idx...] }
			this.clusterIndices = {};
			for (let i = 0; i < k; i++) this.clusterIndices[i] = [];

			clusters.forEach((clusterIdx, originalIndex) => {
				this.clusterIndices[clusterIdx].push(originalIndex);
			});

			// --- LOG CLUSTER SIZES FROM INDEX LISTS ---
			// console.log("%c Cluster Population Counts:", "color: #FB923C; font-weight: bold;");
			// Object.keys(this.clusterIndices).forEach(clusterIdx => {
			// 	// Access the list of indices we just created and get its length
			// 	const indicesList = this.clusterIndices[clusterIdx];
			// 	const count = indicesList.length;

			// 	console.log(
			// 		`%c Group ${parseInt(clusterIdx) + 1}: ${count} indices mapped`);
			// });

			// --- MSE CALCULATION ---
			// computeInformation returns an array: [{centroid, error, size}, ...]
			const info = result.computeInformation(embeddings);

			// Sum the squared errors from all clusters
			const totalSquaredError = info.reduce((sum, cluster) => sum + cluster.error, 0);

			// Calculate the Mean Squared Error (MSE)
			const mse = totalSquaredError / embeddings.length;

			console.log(`%c MyPlugin Clustering Stats (k=${k}):`, 'color: #60A5FA; font-weight: bold;');
			console.log(`>> Mean Squared Error (MSE): ${mse.toFixed(6)}`);
			console.log(`>> Total Squared Error: ${totalSquaredError.toFixed(4)}`);
			// -----------------------

			const activePalette = Array.from({ length: k }, (_, i) => MASTER_PALETTE[i % MASTER_PALETTE.length]);

			return projected.map((point, i) => {
				const clusterIdx = clusters[i];
				return {
					x: point[0],
					y: point[1],
					clusterId: `Group ${clusterIdx + 1}`,
					color: activePalette[clusterIdx].main,
					clusterIndex: clusterIdx
				};
			});

		} catch (err) {
			console.error("MyPlugin: Math error", err);
			return [];
		}
	}

	initGraph() {
		const canvas = document.getElementById('pointCloud');
		const tooltip = document.getElementById('graph-tooltip');
		if (!canvas || !tooltip || !this.points) return;
		const ctx = canvas.getContext('2d');

		// ... (Your existing DPI scaling and PCA scaling logic remains the same) ...
		const dpr = window.devicePixelRatio || 1;
		canvas.width = 400 * dpr;
		canvas.height = 400 * dpr;
		canvas.style.width = '400px';
		canvas.style.height = '400px';
		ctx.scale(dpr, dpr);

		const margin = 40;
		const xCoords = this.points.map(p => p.x);
		const yCoords = this.points.map(p => p.y);
		const minX = Math.min(...xCoords), maxX = Math.max(...xCoords);
		const minY = Math.min(...yCoords), maxY = Math.max(...yCoords);

		this.points.forEach(p => {
			p.canvasX = margin + ((p.x - minX) / (maxX - minX)) * (400 - margin * 2);
			p.canvasY = margin + ((p.y - minY) / (maxY - minY)) * (400 - margin * 2);
		});

		this.clusters = [...new Set(this.points.map(p => p.clusterIndex))].map(idx => {
			const pInC = this.points.filter(p => p.clusterIndex === idx);
			const palette = [
				{ main: '#60A5FA', bg: '#DBEAFE' }, { main: '#34D399', bg: '#D1FAE5' },
				{ main: '#FBBF24', bg: '#FEF3C7' }, { main: '#F87171', bg: '#FEE2E2' },
				{ main: '#A78BFA', bg: '#EDE9FE' }, { main: '#F472B6', bg: '#FCE7F3' },
				{ main: '#FB923C', bg: '#FFEDD5' }
			];
			return {
				index: idx,
				id: pInC[0].clusterId,
				color: palette[idx % palette.length].main,
				bgColor: palette[idx % palette.length].bg,
				count: pInC.length,
				center: {
					x: pInC.reduce((a, b) => a + b.canvasX, 0) / pInC.length,
					y: pInC.reduce((a, b) => a + b.canvasY, 0) / pInC.length
				}
			};
		});

		let hoveredClusterIdx = null;

		const draw = () => {
			ctx.clearRect(0, 0, 400, 400);
			this.clusters.forEach(c => {
				const isHovered = (hoveredClusterIdx === c.index);
				ctx.globalAlpha = isHovered ? 0.3 : 0.05;
				ctx.fillStyle = c.bgColor;
				ctx.beginPath();
				ctx.arc(c.center.x, c.center.y, 150, 0, Math.PI * 2);
				ctx.fill();
			});

			ctx.globalAlpha = 1.0;
			this.points.forEach(p => {
				const isHovered = p.clusterIndex === hoveredClusterIdx;
				ctx.beginPath();
				ctx.arc(p.canvasX, p.canvasY, isHovered ? 5 : 3, 0, Math.PI * 2);
				ctx.fillStyle = p.color;
				ctx.globalAlpha = (hoveredClusterIdx === null || isHovered) ? 1.0 : 0.2;
				ctx.fill();
				if (isHovered) {
					ctx.strokeStyle = "white";
					ctx.stroke();
				}
			});
		};

		// --- NEW CLICK INTERACTION ---
		canvas.onclick = (e) => {
			if (hoveredClusterIdx === null) return;

			if (typeof VIEWER === 'undefined' || !VIEWER.viewport) {
				console.error("MyPlugin: Global 'VIEWER' not found.");
				return;
			}

			// 1. Reset previous selection if it exists
			if (this.selected_stars && this.selected_stars.length > 0) {
				this.setStarsHighlight(this.selected_stars, false);
			}

			// 2. Capture the new indices
			const indices = this.clusterIndices[hoveredClusterIdx];
			this.selected_stars = [...indices];
			this.setStarsHighlight(this.selected_stars, true);

			const registers = this.data.spatial_registers;
			let minX = Infinity, maxX = -Infinity;
			let minY = Infinity, maxY = -Infinity;
			indices.forEach(idx => {
				const coord = registers[idx];
				if (coord[0] < minX) minX = coord[0];
				if (coord[0] > maxX) maxX = coord[0];
				if (coord[1] < minY) minY = coord[1];
				if (coord[1] > maxY) maxY = coord[1];
			});

			// 1. Create the Image Rectangle
			const imageRect = new OpenSeadragon.Rect(minX, minY, maxX - minX, maxY - minY);

			// 2. Convert to Viewport coordinates
			const viewportRectRaw = VIEWER.viewport.imageToViewportRectangle(imageRect);

			// 3. Wrap it in a proper OSD Rect to enable .inset()
			const viewportRect = new OpenSeadragon.Rect(
				viewportRectRaw.x,
				viewportRectRaw.y,
				viewportRectRaw.width,
				viewportRectRaw.height
			);

			// 4. Zoom with padding (-0.1 expands the box by 10%)
			VIEWER.viewport.fitBounds(viewportRect, false);

			console.log(`Zooming to Group ${hoveredClusterIdx + 1} (${indices.length} points)`);
		};

		canvas.onmousemove = (e) => {
			const rect = canvas.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			let closest = null, minDist = Infinity;
			this.clusters.forEach(c => {
				const d = Math.hypot(mouseX - c.center.x, mouseY - c.center.y);
				if (d < minDist) { minDist = d; closest = c; }
			});

			hoveredClusterIdx = (minDist < 60) ? closest.index : null;
			canvas.style.cursor = hoveredClusterIdx !== null ? 'pointer' : 'default';

			if (hoveredClusterIdx !== null) {
				tooltip.style.display = 'block';
				tooltip.style.left = `${e.clientX + 10}px`;
				tooltip.style.top = `${e.clientY + 10}px`;
				tooltip.innerHTML = `<strong>${closest.id}</strong>: ${closest.count} points<br><small>Click to zoom on slide</small>`;
			} else {
				tooltip.style.display = 'none';
			}
			draw();
		};

		draw();
	}

	handleUpdate(e) {
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
							data.push("26b07a90fb215e06a13e98a1762819b0")
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
		const canvasHtml = `
			<div id="graph-container" style="position: relative; cursor: default; user-select: none;">
				<canvas id="pointCloud" width="400" height="1500" style="background:#1a1a1a; border-radius: 8px; display: block;"></canvas>
				<div id="graph-tooltip" style="
					position: absolute; 
					pointer-events: none; 
					background: rgba(0, 0, 0, 0.85); 
					color: white; 
					padding: 8px 12px; 
					border-radius: 4px; 
					font-size: 12px; 
					display: none; 
					white-space: nowrap;
					border: 1px solid #444;
					box-shadow: 0 4px 6px rgba(0,0,0,0.3);
					z-index: 1000;
				"></div>
			</div>`;


		USER_INTERFACE.addHtml(
			new UI.FloatingWindow({
				id: "graph-window",
				title: "WSI Data Graph",
			}, canvasHtml)
		);
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

					const currentZoom = VIEWER.viewport.getZoom();

					// 1. SET ZOOM THRESHOLD
					// Change 0.5 to your preferred zoom level (higher = must zoom in more)
					const minZoomToShow = 5;
					const isZoomedInEnough = currentZoom >= minZoomToShow;

					// 2. GET VIEWPORT BOUNDS (Image Coordinates)
					// This tells us exactly what part of the image is on screen
					const viewportBounds = VIEWER.viewport.getBounds();
					const imageBounds = VIEWER.viewport.viewportToImageRectangle(viewportBounds);

					this._starOverlays.forEach(rec => {
						try {
							// 3. CULLING LOGIC
							// Check if the star's X/Y is within the current visible rectangle
							const isVisible = isZoomedInEnough &&
								rec.x >= imageBounds.x &&
								rec.x <= (imageBounds.x + imageBounds.width) &&
								rec.y >= imageBounds.y &&
								rec.y <= (imageBounds.y + imageBounds.height);

							if (!isVisible) {
								rec.el.style.display = 'none'; // Hide it entirely
								return; // Skip expensive coordinate calculations
							}

							// 4. ONLY CALCULATE FOR VISIBLE STARS
							rec.el.style.display = 'flex';
							const vp = item.imageToViewportCoordinates(rec.x, rec.y, true);
							const px = VIEWER.viewport.pixelFromPoint(vp, true);

							let dynamicSize = rec.sizePx * (currentZoom * 0.01);
							dynamicSize = Math.max(12, Math.min(dynamicSize, 64));

							rec.el.style.width = Math.round(dynamicSize) + 'px';
							rec.el.style.height = Math.round(dynamicSize) + 'px';
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

	setStarsHighlight(indices, highlight = true) {
		if (!this._starOverlays) return;

		const targetColor = highlight ? '#ff0' : '#000';

		indices.forEach(idx => {
			const star = this._starOverlays[idx];
			if (star && star.el) {
				const path = star.el.querySelector('path');
				if (path) {
					path.setAttribute('fill', targetColor);
				}

				// Maintain consistency with your existing selection array if needed
				if (highlight) {
					// Optional: Ensure this [x,y] isn't already in star_selection to avoid duplicates
					const coords = this.data.spatial_registers[idx];
					const exists = this.star_selection.some(c => c[0] === coords[0] && c[1] === coords[1]);
					if (!exists) this.star_selection.push(coords);
				}
			}
		});
	}
}

addPlugin("my_plugin", MyPlugin);
