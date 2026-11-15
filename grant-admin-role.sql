/*
  Grant ADMIN to an existing active account for a test/operations environment.
  Set @AdminEmail to the exact email of the account you have already created.
  This script does not create users or handle passwords.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @AdminEmail NVARCHAR(320) = N'admin-test@example.com';
DECLARE @UserId INT;
DECLARE @RoleId INT;

BEGIN TRY
    BEGIN TRANSACTION;

    IF @AdminEmail = N'admin-test@example.com'
    BEGIN
        ;THROW 51099, 'Replace the example email with the exact email of the intended existing account.', 1;
    END;

    SELECT @UserId = UserId
    FROM dbo.Users WITH (UPDLOCK, HOLDLOCK)
    WHERE Email = @AdminEmail AND IsActive = 1;

    IF @UserId IS NULL
    BEGIN
        ;THROW 51100, 'No active account matches @AdminEmail. Create/sign up the account first, then edit this script.', 1;
    END;

    SELECT @RoleId = RoleId
    FROM dbo.Roles WITH (UPDLOCK, HOLDLOCK)
    WHERE RoleCode = N'ADMIN';

    IF @RoleId IS NULL
    BEGIN
        ;THROW 51101, 'ADMIN role is missing. Review and apply the approved role seed first.', 1;
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.UserRoles WITH (UPDLOCK, HOLDLOCK)
        WHERE UserId = @UserId AND RoleId = @RoleId
    )
    BEGIN
        INSERT dbo.UserRoles (UserId, RoleId)
        VALUES (@UserId, @RoleId);
    END;

    COMMIT TRANSACTION;
    PRINT 'ADMIN role is assigned to the existing active account.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
