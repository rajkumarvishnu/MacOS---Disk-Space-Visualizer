"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Treemap } from "recharts";
import { motion } from "framer-motion";

import { listen } from "@tauri-apps/api/event";

export default function Home() {
	const [diskData, setDiskData] = useState(null);
	const [selectedItem, setSelectedItem] = useState(null);
	const [dimensions, setDimensions] = useState({
		width: typeof window !== "undefined" ? window.innerWidth - 40 : 800,
		height: typeof window !== "undefined" ? window.innerHeight - 120 : 600,
	});
	const data = listen<string>("disk", (event) => {
		try {
			const parsedData = JSON.parse(event.payload);
			const disk = Array.isArray(parsedData)
				? { name: "root", size: 0, children: parsedData }
				: parsedData;
			setDiskData(disk);
			console.log("Received periodic disk data:", disk);
		} catch (error) {
			console.error("Failed to parse disk data:", error);
		}
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
					path: "/Users/vishnurajkumar/Developer",
					//path: "/Users/vishnurajkumar",
				});
				setDiskData(result);
			} catch (error) {
				console.error("Failed to fetch disk utilization:", error);
			}
		}

		fetchDiskData();
	}, []);

	async function handleContextMenu(event, path, name) {
		event.preventDefault();
		console.log("Right-clicked on item:", path);
		console.log("Event:", event);
		console.log("Revealing path:", path["root"] + "/" + name); // Add logging for debugging
		try {
			await invoke("reveal_in_finder", {
				path: path["root"].toString() + "/" + name, // Ensure full path is used
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
			name: item.name.split("/").pop(), // Extract folder name
			size: item.size,
			root: item.name, // Keep the full path for Finder
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
		// New color calculation based on size
		const hue = Math.max(200, 280 - (sizeInMB / 100) * 80); // Range from purple to blue
		const saturation = Math.min(90, 60 + (sizeInMB / 100) * 30); // Increase saturation with size
		const lightness = Math.max(25, 45 - (sizeInMB / 100) * 20); // Darker for larger files
		const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

		return (
			<motion.g
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.5 }}
				onContextMenu={(e) => handleContextMenu(e, root, name)}
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

	return (
		<div
			style={{
				width: "100vw",
				height: "100vh",
				margin: 0,
				padding: 0,
				overflow: "hidden",
				background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
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
			<div style={{ flex: 1, overflow: "auto" }}>
				{/* Dynamically size the treemap to fit remaining space */}
				{diskData ? (
					<Treemap
						width={dimensions.width}
						height={dimensions.height}
						data={[renderTreemapItem(diskData)]}
						dataKey="size"
						ratio={4 / 3}
						stroke="#fff"
						fill="#4f46e5" // Shadcn primary color
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
		</div>
	);
}
