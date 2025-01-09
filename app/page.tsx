"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core"; // Correct import
import { open } from "@tauri-apps/plugin-shell"; // Import open from tauri shell
import { Treemap } from "recharts"; // Import Treemap from recharts

export default function Home() {
	const [diskData, setDiskData] = useState(null);
	const [selectedItem, setSelectedItem] = useState(null);

	useEffect(() => {
		async function fetchDiskData() {
			try {
				console.log("Fetching disk utilization...");
				const result = await invoke("get_disk_utilization", {
					path: "/Users/vishnurajkumar/Developer/MacOS - Disk Space Visualizer",
				});
				setDiskData(result);
			} catch (error) {
				console.error("Failed to fetch disk utilization:", error);
			}
		}

		fetchDiskData();
	}, []);

	function handleContextMenu(event, path) {
		event.preventDefault();
		open(`file://${path}`);
	}

	function handleClick(item) {
		const f = item.name + " - " + item.size;
		setSelectedItem(f);
	}

	function renderTreemapItem(item) {
		return {
			name: item.name,
			size: item.size,
			children: item.children.map(renderTreemapItem),
		};
	}

	return (
		<div
			style={{
				backgroundColor: "green",
				padding: "20px",
				height: "100vh",
				overflow: "auto",
			}}
		>
			<h1>Disk Utilization</h1>
			{diskData ? (
				<Treemap
					width={800}
					height={600}
					data={[renderTreemapItem(diskData)]}
					dataKey="size"
					ratio={4 / 3}
					stroke="#fff"
					fill="#8884d8"
					onClick={(item) => handleClick(item)}
				/>
			) : (
				<p>Loading...</p>
			)}
			{selectedItem && (
				<div
					style={{
						position: "fixed",
						bottom: "10px",
						left: "10px",
						backgroundColor: "white",
						padding: "10px",
						border: "1px solid black",
					}}
				>
					<p>Selected Folder: {selectedItem}</p>
				</div>
			)}
		</div>
	);
}
