"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Treemap } from "recharts";
import { motion } from "framer-motion";

export default function Home() {
	const [diskData, setDiskData] = useState(null);
	const [selectedItem, setSelectedItem] = useState(null);
	const [dimensions, setDimensions] = useState({
		width: typeof window !== "undefined" ? window.innerWidth - 40 : 800,
		height: typeof window !== "undefined" ? window.innerHeight - 120 : 600,
	});
	const [searchQuery, setSearchQuery] = useState("");
	const [filteredData, setFilteredData] = useState(null);
	const [settings, setSettings] = useState({
		colorScheme: "default",
		animationSpeed: 0.3,
	});

	useEffect(() => {
		function handleResize() {
			setDimensions({
				width: window.innerWidth - 40,
				height: window.innerHeight - 120,
				});
		}

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	useEffect(() => {
		async function fetchDiskData() {
			try {
				console.log("Fetching disk utilization...");
				const result = await invoke("get_disk_utilization", {
					path: "/Users/vishnurajkumar",
				});
				setDiskData(result);
			} catch (error) {
				console.error("Failed to fetch disk utilization:", error);
			}
		}

		const intervalId = setInterval(fetchDiskData, 5000);
		fetchDiskData();

		return () => clearInterval(intervalId);
	}, []);

	useEffect(() => {
		if (searchQuery) {
			const filterItems = (item) => {
				if (item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
					return true;
				}
				if (item.children) {
					return item.children.some(filterItems);
				}
				return false;
			};

			const filtered = {
				...diskData,
				children: diskData.children.filter(filterItems),
			};
			setFilteredData(filtered);
		} else {
			setFilteredData(diskData);
		}
	}, [searchQuery, diskData]);

	async function handleContextMenu(event, path) {
		event.preventDefault();
		console.log(path);
		console.log("Revealing path:", path["root"]);
		try {
			await invoke("reveal_in_finder", {
				path: path["root"].toString(),
			});
		} catch (error) {
			console.error("Failed to reveal in finder:", error);
		}
	}

	function handleClick(item) {
		const f =
			item.name + " - " + (item.size / (1024 * 1024)).toFixed(2) + " MB";
		setSelectedItem(f);
	}

	function renderTreemapItem(item) {
		return {
			name: item.name.split("/").pop(),
			size: item.size,
			root: item.name,
			children: item.children.map(renderTreemapItem),
		};
	}

	function CustomTreemapContent({
		depth,
		x,
		y,
		width,
		height,
		name,
		size,
		root,
	}: {
		depth: number;
		x: number;
		y: number;
		width: number;
		height: number;
		name: string;
		size: number;
		root: string;
	}) {
		const sizeInMB = (size / (1024 * 1024)).toFixed(2);
		const hue = Math.max(200, 280 - (sizeInMB / 100) * 80);
		const saturation = Math.min(90, 60 + (sizeInMB / 100) * 30);
		const lightness = Math.max(25, 45 - (sizeInMB / 100) * 20);
		const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

		return (
			<motion.g
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: settings.animationSpeed }}
				onContextMenu={(e) => handleContextMenu(e, root)}
				style={{ cursor: "context-menu" }}
			>
				<rect
					x={x}
					y={y}
					width={width}
					height={height}
					style={{
						fill: color,
						stroke: "rgba(255,255,255,0.1)",
						strokeWidth: 1,
						strokeOpacity: 0.8,
					}}
				/>
				{width > 40 && height > 20 && (
					<text
						x={x + 10}
						y={y + 20}
						fill="rgba(255,255,255,0.9)"
						fontSize={14}
					>
						{name}
					</text>
				)}
				{width > 40 && height > 40 && (
					<text
						x={x + 10}
						y={y + 40}
						fill="rgba(255,255,255,0.7)"
						fontSize={12}
					>
						{sizeInMB} MB
					</text>
				)}
			</motion.g>
		);
	}

	function handleExport() {
		const dataStr = JSON.stringify(diskData, null, 2);
		const blob = new Blob([dataStr], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "disk_utilization.json";
		a.click();
		URL.revokeObjectURL(url);
	}

	return (
		<div
			style={{
				width: "100vw",
				height: "100vh",
				margin: 0,
				padding: 0,
				overflow: "hidden",
				background: "linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)",
				color: "#e2e8f0",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<h1
				style={{ padding: "20px", fontSize: "24px", fontWeight: "500" }}
			>
				Disk Utilization
				<span
					style={{
						fontSize: "14px",
						opacity: 0.7,
						marginLeft: "10px",
						fontWeight: "normal",
					}}
				>
					(Right-click to reveal in Finder)
				</span>
			</h1>
			<div style={{ padding: "0 20px" }}>
				<input
					type="text"
					placeholder="Search..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					style={{
						width: "100%",
						padding: "10px",
						marginBottom: "20px",
						borderRadius: "8px",
						border: "1px solid rgba(255, 255, 255, 0.1)",
						backgroundColor: "rgba(255, 255, 255, 0.1)",
						color: "#fff",
					}}
				/>
			</div>
			<div style={{ flex: 1, overflow: "auto" }}>
				{filteredData ? (
					<Treemap
						width={dimensions.width}
						height={dimensions.height}
						data={[renderTreemapItem(filteredData)]}
						dataKey="size"
						ratio={4 / 3}
						stroke="#fff"
						fill="#4f46e5"
						content={CustomTreemapContent}
						onClick={(item) => handleClick(item)}
					/>
				) : (
					<p>Loading...</p>
				)}
			</div>
			{selectedItem && (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
					style={{
						position: "fixed",
						bottom: "20px",
						left: "20px",
						backgroundColor: "rgba(255, 255, 255, 0.1)",
						backdropFilter: "blur(12px)",
						padding: "15px 20px",
						borderRadius: "12px",
						border: "1px solid rgba(255, 255, 255, 0.1)",
						color: "#fff",
						boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
					}}
				>
					<p style={{ margin: 0 }}>Selected: {selectedItem}</p>
				</motion.div>
			)}
			<div style={{ padding: "20px", display: "flex", justifyContent: "space-between" }}>
				<button
					onClick={handleExport}
					style={{
						padding: "10px 20px",
						borderRadius: "8px",
						border: "none",
						backgroundColor: "#4f46e5",
						color: "#fff",
						cursor: "pointer",
					}}
				>
					Export to JSON
				</button>
				<button
					onClick={() => setSettings({ ...settings, colorScheme: settings.colorScheme === "default" ? "dark" : "default" })}
					style={{
						padding: "10px 20px",
						borderRadius: "8px",
						border: "none",
						backgroundColor: "#4f46e5",
						color: "#fff",
						cursor: "pointer",
					}}
				>
					Toggle Color Scheme
				</button>
				<button
					onClick={() => setSettings({ ...settings, animationSpeed: settings.animationSpeed === 0.5 ? 1 : 0.5 })}
					style={{
						padding: "10px 20px",
						borderRadius: "8px",
						border: "none",
						backgroundColor: "#4f46e5",
						color: "#fff",
						cursor: "pointer",
					}}
				>
					Toggle Animation Speed
				</button>
			</div>
			<div style={{ padding: "20px" }}>
				<h2>Help</h2>
				<p>Use the search bar to filter disk items by name.</p>
				<p>Right-click on a disk item to reveal it in Finder.</p>
				<p>Use the settings panel to customize the color scheme and animation speed.</p>
				<p>Click the "Export to JSON" button to save the disk utilization data to a JSON file.</p>
			</div>
		</div>
	);
}
