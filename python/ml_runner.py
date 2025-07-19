import sys
import json
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import warnings

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')

def process_csv(file_path):
    try:
        # Load CSV data
        df = pd.read_csv(file_path)
        
        # Basic data info
        original_rows = len(df)
        
        # Drop rows with any null values
        df_clean = df.dropna()
        
        # Select only numeric columns
        numeric_columns = df_clean.select_dtypes(include=[np.number]).columns.tolist()
        
        if len(numeric_columns) < 2:
            raise ValueError("Dataset must have at least 2 numeric columns for regression analysis")
        
        df_numeric = df_clean[numeric_columns]
        
        # Prepare features and target
        # Use the last numeric column as target, rest as features
        feature_columns = numeric_columns[:-1]
        target_column = numeric_columns[-1]
        
        X = df_numeric[feature_columns]
        y = df_numeric[target_column]
        
        # Check if we have enough samples
        if len(X) < 10:
            raise ValueError("Dataset must have at least 10 samples after cleaning")
        
        # Train/test split (80/20)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Train Linear Regression model
        model = LinearRegression()
        model.fit(X_train, y_train)
        
        # Make predictions
        y_pred = model.predict(X_test)
        
        # Calculate evaluation metrics
        r2 = r2_score(y_test, y_pred)
        mae = mean_absolute_error(y_test, y_pred)
        mse = mean_squared_error(y_test, y_pred)
        
        # Prepare results
        results = {
            "r2_score": float(r2),
            "mae": float(mae),
            "mse": float(mse),
            "dataset_info": {
                "total_rows": int(original_rows),
                "rows_after_cleaning": int(len(df_clean)),
                "feature_columns": int(len(feature_columns)),
                "target_column": target_column,
                "feature_names": feature_columns,
                "train_size": int(len(X_train)),
                "test_size": int(len(X_test))
            }
        }
        
        return results
        
    except Exception as e:
        raise Exception(f"ML processing error: {str(e)}")

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python ml_runner.py <csv_file_path>"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    try:
        results = process_csv(file_path)
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
