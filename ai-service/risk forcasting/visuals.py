import matplotlib.pyplot as plt


def plot_forecast(forecasts, key, title_prefix):
    data = forecasts[key]
    history = data["history"]
    forecast = data["forecast"]
    metadata = data["metadata"]

    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(history.index, history.values, label="Historical", linewidth=2)
    ax.plot(
        forecast.index,
        forecast.values,
        linestyle="--",
        linewidth=2,
        label=f"Forecast ({metadata.model_type}, {metadata.cadence}, {metadata.forecast_steps} periods)",
    )
    ax.set_title(f"{title_prefix} ({metadata.cadence})")
    ax.set_xlabel("Date")
    ax.set_ylabel("Quantity")
    ax.grid(alpha=0.2)
    ax.legend()
    fig.tight_layout()
    return fig
