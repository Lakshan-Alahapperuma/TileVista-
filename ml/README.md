# TileVista ML Scripts

This directory contains Python scripts for AI/ML tasks related to TileVista analytics.

## Setup

Install the required Python dependencies:
``bash
pip install -r requirements.txt
``

## Available Scripts

### evaluate_model.py
Evaluates the 30-day demand prediction models (Baseline vs Single-Stage XGBoost vs Two-Stage XGBoost). 
The script fetches the dataset from the running NestJS backend API.

**Usage:**
``bash
python evaluate_model.py
``

*Note: Ensure the backend server is running (
pm run start:dev in ackend/) before executing this script, as it retrieves the dataset via HTTP GET http://localhost:4000/api/admin/analytics/ai/dataset.*

Reports are generated in the eports/ directory.
