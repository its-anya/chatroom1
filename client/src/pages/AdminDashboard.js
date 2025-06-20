import React, { useEffect, useState, useCallback } from 'react';

function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const token = localStorage.getItem('token');

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/users', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch users');
    }
  }, [token]);

  const promoteUser = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/make-admin/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Promotion failed');
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Failed to promote user');
    }
  };

  const removeUser = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/admin/remove-user/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Deletion failed');
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Failed to delete user');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="px-4 py-2 border">Username</th>
              <th className="px-4 py-2 border">Role</th>
              <th className="px-4 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border">{user.username}</td>
                <td className="px-4 py-2 border">{user.role}</td>
                <td className="px-4 py-2 border space-x-2">
                  {user.role !== 'admin' && (
                    <button
                      onClick={() => promoteUser(user._id)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                    >
                      Make Admin
                    </button>
                  )}
                  <button
                    onClick={() => removeUser(user._id)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminDashboard;