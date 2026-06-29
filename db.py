import random
import string
import os
from datetime import datetime
from pymongo import MongoClient
import mysql.connector

MONGO_URL = os.getenv("MONGO_URL")

if not MONGO_URL:
    MONGO_URL = "mongodb://mongo:jlNUsIcGtxeFpCXjqCtwVblWAnIrImEh@mongodb.railway.internal:27017"

client = MongoClient(MONGO_URL)
db_mongo = client["ffmy_support_db"]
tickets_collection = db_mongo["tickets"]
users_collection = db_mongo["users"]


def find_or_create_oauth_user(provider, provider_id, name, email=None):
    field = "googleId" if provider == "google" else "facebookId"
    user = users_collection.find_one({field: provider_id})
    if user:
        return user

    user_data = {
        "name": name or "User",
        field: provider_id,
        "email": email,
        "created_at": datetime.utcnow(),
    }
    result = users_collection.insert_one(user_data)
    user_data["_id"] = result.inserted_id
    return user_data


def serialize_user(user):
    return {
        "id": str(user["_id"]),
        "name": user.get("name", "User"),
        "email": user.get("email"),
    }

def get_mysql_conn():
    return mysql.connector.connect(
        host=os.getenv("MYSQLHOST", "localhost"),
        user=os.getenv("MYSQLUSER", "root"),
        password=os.getenv("MYSQLPASSWORD", ""),
        database=os.getenv("MYSQLDATABASE", "ffmy_support"),
        port=os.getenv("MYSQLPORT", "3306")
    )

def sync_to_mysql(ticket_data):
    conn = get_mysql_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tickets_sync (
                ticket_id VARCHAR(20) PRIMARY KEY,
                uid VARCHAR(50),
                nickname VARCHAR(100),
                request_type VARCHAR(50),
                description TEXT,
                status VARCHAR(20),
                created_at DATETIME,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        
        sql = """INSERT INTO tickets_sync 
                 (ticket_id, uid, nickname, request_type, description, status, created_at) 
                 VALUES (%s, %s, %s, %s, %s, %s, %s) 
                 ON DUPLICATE KEY UPDATE status=%s"""
                 
        dt_obj = datetime.fromisoformat(ticket_data['created_at'].replace('Z', ''))
        
        val = (
            ticket_data['ticket_id'], 
            ticket_data['uid'], 
            ticket_data['nickname'], 
            ticket_data['type'], 
            ticket_data['description'], 
            ticket_data['status'], 
            dt_obj,
            ticket_data['status']
        )
        cursor.execute(sql, val)
        conn.commit()
    finally:
        cursor.close()
        conn.close()

def generate_ticket_id():
    numbers = ''.join(random.choices(string.digits, k=6))
    return f"FFMY-{numbers}"

def create_ticket(uid, nickname, request_type, description, privacy_policy_accepted, ban_screenshot_accepted, attachments=None, user_id=None, user_email=None):
    ticket_id = generate_ticket_id()
    
    ticket_data = {
        "ticket_id": ticket_id,
        "uid": uid,
        "nickname": nickname,
        "type": request_type,
        "description": description,
        "privacy_policy_accepted": privacy_policy_accepted,
        "ban_screenshot_accepted": ban_screenshot_accepted,
        "user_id": user_id,
        "user_email": user_email,
        "status": "Open",
        "attachments": attachments or [],
        "messages": [],
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    
    tickets_collection.insert_one(ticket_data)
    if "_id" in ticket_data:
      del ticket_data["_id"]
    return ticket_data

def update_ticket_attachments(ticket_id, attachments_meta):
    tickets_collection.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"attachments": attachments_meta}}
    )

def get_all_tickets(status=None):
    query = {}
    if status:
        query["status"] = status
        
    cursor = tickets_collection.find(query, {"_id": 0}).sort("created_at", -1)
    return list(cursor)

def get_tickets_by_uid(uid):
    cursor = tickets_collection.find({"uid": uid}, {"_id": 0}).sort("created_at", -1)
    return list(cursor)


def get_tickets_by_user_id(user_id):
    cursor = tickets_collection.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
    return list(cursor)

def get_ticket(ticket_id):
    return tickets_collection.find_one({"ticket_id": ticket_id}, {"_id": 0})

def update_ticket_status(ticket_id, status):
    result = tickets_collection.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"status": status}}
    )
    return result.modified_count > 0

def add_message_to_ticket(ticket_id, sender, text):
    now = datetime.utcnow().isoformat() + "Z"
    message = {
        "sender": sender,
        "text": text,
        "timestamp": now
    }
    
    new_status = "Solved" if sender == "admin" else "Open"
    
    tickets_collection.update_one(
        {"ticket_id": ticket_id},
        {
            "$push": {"messages": message},
            "$set": {"status": new_status}
        }
    )
    
    return get_ticket(ticket_id)

def delete_ticket(ticket_id):
    result = tickets_collection.delete_one({"ticket_id": ticket_id})
    return result.deleted_count > 0