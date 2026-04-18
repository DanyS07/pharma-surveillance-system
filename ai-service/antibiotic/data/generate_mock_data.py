import pandas as pd
import numpy as np
import os

np.random.seed(42)

antibiotics = ['Amoxicillin', 'Azithromycin', 'Ciprofloxacin', 'Metronidazole', 'Doxycycline']
regions = ['Kerala', 'Tamil Nadu', 'Karnataka', 'Maharashtra']
pharmacies = [f'PH{str(i).zfill(3)}' for i in range(1, 21)]

rows = []
for month in range(1, 13):
    for pharma in pharmacies:
        for ab in antibiotics:
            region = np.random.choice(regions)
            units = np.random.randint(50, 200)  # normal sales

            # Inject anomalies randomly
            if np.random.rand() < 0.05:
                units = np.random.randint(800, 1500)  # spike!

            rows.append({
                'date': f'2024-{str(month).zfill(2)}-01',
                'antibiotic_name': ab,
                'region': region,
                'pharmacy_id': pharma,
                'units_sold': units,
                'month': month
            })

df = pd.DataFrame(rows)
os.makedirs('data', exist_ok=True)
df.to_csv('data/sample_sales.csv', index=False)
print(f"✅ Generated {len(df)} rows → data/sample_sales.csv")