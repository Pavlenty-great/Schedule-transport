from flask import Flask
from datetime import datetime
from config import Config
from routes import register_blueprints
from helpers import get_weekday_id

app = Flask(__name__)
app.config.from_object(Config)
app.secret_key = Config.SECRET_KEY

# Регистрация blueprint'ов
register_blueprints(app)

# Глобальный контекстный процессор для шаблонов
@app.context_processor
def utility_processor():
    return {
        'now': datetime.now,
        'datetime': datetime,
        'get_weekday_id': get_weekday_id
    }

if __name__ == '__main__':
    app.run(debug=True)