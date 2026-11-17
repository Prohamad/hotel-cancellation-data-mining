# Hotel Booking Cancellation Prediction Using Data Mining

CIS 517 · Data Mining and Warehousing — course project.

**Live website:** https://YOUR-GITHUB-USERNAME.github.io/REPO-NAME/

A hotel loses revenue when a booking is canceled and the room stays empty. This project asks whether a
cancellation can be predicted **at booking time**, how room prices change over the year, and which kinds of
bookings exist. It follows the course workflow, from problem definition to findings, on the public
*Hotel Booking Demand* dataset.

## The idea

| | |
|---|---|
| **Problem** | Cancellations cost hotels revenue. |
| **Purpose** | Predict cancellation from attributes known when the booking is made. |
| **Who benefits** | Hotels, travel agencies and researchers. |
| **Data** | 119,390 bookings × 32 attributes of two hotels in Portugal (City Hotel, Lisbon · Resort Hotel, Algarve), arrivals July 2015 – August 2017. |

## Research questions

| | Question | Task | Notebook |
|---|---|---|---|
| RQ1 | Can cancellation be predicted from attributes known at booking time, and which classifier performs best? | Classification | `06_classification` |
| RQ2 | Does the average daily rate (ADR) vary by arrival month and hotel type, reflecting seasonal demand? | Numeric prediction | `08_regression` |
| RQ3 | Can bookings be grouped into distinct segments, and do these segments differ in cancellation? | Clustering | `07_clustering` |

## Process (Knowledge Discovery from Data)

| Step | Where |
|---|---|
| Data understanding | `01_data_understanding` |
| Data cleaning and transformation | `02_preprocessing`, `03_outlier_analysis` |
| Data integration (star-schema data warehouse, SQLite) | `04_data_warehouse` |
| Exploratory analysis | `05_eda` |
| Data mining: classification, clustering, numeric prediction | `06`, `07`, `08` |
| Pattern evaluation and presentation | notebooks and website |

Preprocessing: 119,390 → 87,396 (exact duplicates removed) → 86,637 (invalid records removed) → **86,620**
rows (17 impossible guest counts removed).

## Main results

**Classification (test set, 17,324 bookings)**

| Model | Accuracy | F1 | AUC |
|---|---|---|---|
| Decision Tree (max_depth = 9) | 79.2% | 54.3% | 0.800 |
| Naive Bayes | 72.3% | 53.9% | 0.751 |
| k-NN (k = 31) | 77.3% | 47.7% | 0.763 |
| Logistic Regression | 77.8% | 45.8% | 0.779 |
| **Random Forest** | **80.7%** | **59.6%** | **0.837** |

Always predicting "not canceled" gives 72.3%. `lead_time` is the first split of the decision tree and the
strongest signal. All models find about half or fewer of the cancellations because the classes are imbalanced.

**Clustering:** Hopkins statistic (0.99), K-Means (k-means++), K-Medoids, AGNES (single/average/complete/centroid) and DBSCAN were compared; K-Means with k = 4 (elbow method, silhouette ≈ 0.32) finds families/groups (39% canceled),
single guests (19%), guests with several special requests (20%) and typical couples (30%).

**Numeric prediction (ADR):** decision tree regression R² = 0.754, RMSE = €24.9, MAE = €15.8, better than
multiple linear regression (R² = 0.639). Prices are strongly seasonal: August is about +€49 and January about
−€31 compared with April.

## Repository structure

```
notebooks/   the eight Jupyter notebooks (run in order, outputs saved)
data/raw/        original dataset
data/processed/  cleaned and final datasets
warehouse/   hotel_dw.sqlite (star schema: 1 fact table, 6 dimensions)
figures/     figures exported by the notebooks
docs/        the website (served by GitHub Pages)
tools/       build_notebooks.py: renders the notebooks as website pages
```

## Run the notebooks

```bash
pip install -r requirements.txt
jupyter notebook notebooks/
```

Run the notebooks in numeric order; each one reads the output of the previous step.

## Website

Static pages (HTML, CSS, JavaScript) in `docs/`: one page per stage, the notebooks as styled pages, an
interactive BI-style dashboard with filters, and a data warehouse explorer where the real SQLite file runs in
the browser (sql.js) so SQL queries can be written live.

To view it locally (opening the file directly does not work, the pages load data files):

```bash
cd docs
python3 -m http.server 8000
# open http://localhost:8000
```

To rebuild the notebook pages after changing a notebook: `python tools/build_notebooks.py`.

## Team

Hamad Alsultan · Rakan Alotaibi · Abdullah Alomran · Mohammed Sufran · Yazn Bashraheel · Abdulellah Alghamdi

## Data source

Antonio, N., de Almeida, A., & Nunes, L. (2019). Hotel booking demand datasets. *Data in Brief*, 22, 41–49.
Kaggle: `jessemostipak/hotel-booking-demand`.
