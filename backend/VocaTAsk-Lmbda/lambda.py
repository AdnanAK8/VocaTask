import os
import shutil

package_dir = os.path.dirname(os.path.abspath(__file__))
tmp_dir = os.path.realpath("/tmp")
database_path = os.environ.get("DATABASE_PATH", "tasks.db")
if not database_path:
    database_path = "tasks.db"

if os.path.isabs(database_path):
    absolute_path = os.path.abspath(database_path)
    if absolute_path != tmp_dir and os.path.commonpath((tmp_dir, absolute_path)) == tmp_dir:
        database_path = absolute_path
    else:
        database_path = os.path.join(
            tmp_dir, os.path.basename(absolute_path) or "tasks.db"
        )
else:
    database_path = os.path.join(tmp_dir, database_path)

os.makedirs(os.path.dirname(database_path) or tmp_dir, exist_ok=True)
bundled_database = os.path.join(package_dir, "tasks.db")
if not os.path.exists(database_path) and os.path.isfile(bundled_database):
    shutil.copy2(bundled_database, database_path)

os.environ["DATABASE_PATH"] = database_path

from mangum import Mangum
from app.main import app

handler = Mangum(app)
